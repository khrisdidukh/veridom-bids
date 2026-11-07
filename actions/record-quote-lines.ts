import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadBid, refreshCheckFlags, requireUser } from "../server/lib/bids.js";

const line = z.object({
  scopeItemId: z.string().nullable().describe("Scope item this position covers, or null when it matches none (extras)"),
  position: z.string().max(20).optional().describe('Position number on the quote, e.g. "03.02"'),
  description: z.string().min(1).max(400).describe("Position text, shortened, original language"),
  quantity: z.coerce.number().min(0).nullable().optional().describe("Quantity as quoted"),
  unit: z.string().max(20).nullable().optional().describe('Unit normalised to the scope unit when equal: "m²", "m", "pcs", "lump sum"'),
  unitPrice: z.coerce.number().min(0).nullable().optional().describe("Net unit price in EUR"),
  total: z.coerce.number().min(0).nullable().optional().describe("Net line total in EUR"),
  coverage: z.enum(["included", "excluded", "optional", "unclear"]).describe("'excluded' for 'bauseits'/'nicht enthalten'; 'optional' for Alternativ/Eventualpositionen"),
  note: z.string().max(300).optional().describe("Why you mapped it this way, when not obvious"),
});

export default defineAction({
  description:
    "Record the extracted positions of one quote, each mapped to a scope item (or null), in one batch. replace=true swaps out lines the agent recorded earlier but keeps lines the user edited. Marks the quote 'extracted' and re-runs the checks; returns the quote's new totals and how many flags were raised.",
  schema: z.object({
    bidId: z.string().describe("Quote id"),
    replace: z.boolean().default(true).describe("Replace earlier agent-recorded lines for this quote"),
    lines: z.array(line).min(1).max(200).describe("Positions from the quote"),
  }),
  run: async ({ bidId, replace, lines }, ctx) => {
    const ownerEmail = requireUser(ctx);
    const { bid, project } = await loadBid(bidId, "editor");
    const scopeIds = [...new Set(lines.map((l) => l.scopeItemId).filter((x): x is string => !!x))];
    if (scopeIds.length) {
      const known = await getDb()
        .select({ id: schema.scopeItems.id })
        .from(schema.scopeItems)
        .where(and(eq(schema.scopeItems.projectId, project.id), inArray(schema.scopeItems.id, scopeIds)));
      const knownIds = new Set(known.map((k) => k.id));
      const unknown = scopeIds.filter((id) => !knownIds.has(id));
      if (unknown.length) fail(`Unknown scope item id(s): ${unknown.join(", ")}. Use ids from get-price-comparison.`, { errorCode: "unknown_scope_item" });
    }
    const bl = schema.bidLines;
    await getDb().transaction(async (tx) => {
      if (replace) await tx.delete(bl).where(and(eq(bl.bidId, bid.id), eq(bl.editedBy, "agent")));
      await tx.insert(bl).values(
        lines.map((l) => ({
          id: crypto.randomUUID(),
          bidId: bid.id,
          projectId: project.id,
          scopeItemId: l.scopeItemId,
          position: l.position ?? null,
          description: l.description,
          quantity: l.quantity ?? null,
          unit: l.unit ?? null,
          unitPrice: l.unitPrice ?? null,
          total: l.total ?? (l.unitPrice != null && l.quantity != null ? Math.round(l.unitPrice * l.quantity * 100) / 100 : null),
          coverage: l.coverage,
          note: l.note ?? null,
          editedBy: "agent" as const,
          ownerEmail,
          orgId: project.orgId,
        })),
      );
      if (bid.status === "received") await tx.update(schema.bids).set({ status: "extracted" }).where(eq(schema.bids.id, bid.id));
    });
    const { flagsRaised, totals } = await refreshCheckFlags(project.id, ownerEmail, project.orgId);
    return { bidId: bid.id, recorded: lines.length, flagsRaisedInProject: flagsRaised, totals: totals.find((t) => t.bidId === bid.id) ?? null };
  },
});
