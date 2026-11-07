import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadBid, refreshCheckFlags, requireUser } from "../server/lib/bids.js";

export default defineAction({
  description:
    "Correct one quote line: its scope mapping, quantity, prices or coverage. The line is then marked as edited by the user, so later re-extraction keeps it.",
  schema: z.object({
    id: z.string().describe("Quote line id"),
    scopeItemId: z.string().nullable().optional().describe("Scope item id, or null to unmap"),
    quantity: z.coerce.number().min(0).nullable().optional().describe("Quantity"),
    unitPrice: z.coerce.number().min(0).nullable().optional().describe("Net unit price, EUR"),
    total: z.coerce.number().min(0).nullable().optional().describe("Net line total, EUR"),
    coverage: z.enum(["included", "excluded", "optional", "unclear"]).optional().describe("Coverage"),
    note: z.string().max(300).nullable().optional().describe("Note"),
  }),
  run: async ({ id, ...patch }, ctx) => {
    const ownerEmail = requireUser(ctx);
    const bl = schema.bidLines;
    const [row] = await getDb().select().from(bl).where(eq(bl.id, id)).limit(1);
    if (!row) fail("Quote line not found.", { errorCode: "not_found", statusCode: 404 });
    const { project } = await loadBid(row.bidId, "editor");
    const clean: Record<string, unknown> = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (("quantity" in clean || "unitPrice" in clean) && !("total" in clean)) {
      const q = (clean.quantity as number | null | undefined) ?? row.quantity;
      const u = (clean.unitPrice as number | null | undefined) ?? row.unitPrice;
      if (q != null && u != null) clean.total = Math.round(q * u * 100) / 100;
    }
    await getDb().update(bl).set({ ...clean, editedBy: "user" }).where(eq(bl.id, id));
    const { totals } = await refreshCheckFlags(project.id, ownerEmail, project.orgId);
    return { id, updated: Object.keys(clean), totals: totals.find((t) => t.bidId === row.bidId) ?? null };
  },
});
