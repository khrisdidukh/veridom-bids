import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadProject, refreshCheckFlags, requireUser } from "../server/lib/bids.js";

const item = z.object({
  id: z.string().optional().describe("Existing scope item id to update; omit to add a new item"),
  trade: z.string().min(1).max(60).describe('Trade, e.g. "Tiling", "Plumbing", "Electrical"'),
  title: z.string().min(1).max(160).describe("What must be done, in plain words"),
  unit: z.string().min(1).max(20).describe('Unit: "m²", "m", "pcs", or "lump sum"'),
  quantity: z.coerce.number().min(0).describe("Quantity in that unit (1 for a lump sum)"),
  required: z.boolean().optional().describe("False for nice-to-have items; missing optional items are not flagged"),
  benchmarkMin: z.coerce.number().min(0).nullable().optional().describe("Lowest fair net unit price in EUR, or null when unknown"),
  benchmarkMax: z.coerce.number().min(0).nullable().optional().describe("Highest fair net unit price in EUR, or null when unknown"),
  notes: z.string().max(500).nullable().optional().describe("Spec details, e.g. tile format or brand"),
});

export default defineAction({
  description:
    "Add or update the owner's scope items (the positions every quote is compared against) in one batch, then re-run the checks. Benchmarks are net EUR per unit.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    items: z.array(item).min(1).max(80).describe("Scope items to add or update"),
  }),
  run: async ({ projectId, items }, ctx) => {
    const ownerEmail = requireUser(ctx);
    const project = await loadProject(projectId, "editor");
    for (const it of items) {
      if (it.benchmarkMin != null && it.benchmarkMax != null && it.benchmarkMax < it.benchmarkMin)
        fail(`Benchmark max is below min for "${it.title}".`, { errorCode: "invalid_range" });
    }
    const s = schema.scopeItems;
    const saved = await getDb().transaction(async (tx) => {
      const [orderRow] = await tx
        .select({ maxOrder: sql<number>`coalesce(max(${s.sortOrder}), 0)` })
        .from(s)
        .where(eq(s.projectId, projectId));
      let order = Number(orderRow?.maxOrder ?? 0);
      const out: { id: string; title: string }[] = [];
      for (const it of items) {
        const values = {
          trade: it.trade.trim(),
          title: it.title.trim(),
          unit: it.unit.trim(),
          quantity: it.quantity,
          required: it.required ?? true,
          benchmarkMin: it.benchmarkMin ?? null,
          benchmarkMax: it.benchmarkMax ?? null,
          notes: it.notes ?? null,
        };
        if (it.id) {
          const [row] = await tx
            .update(s)
            .set(values)
            .where(and(eq(s.id, it.id), eq(s.projectId, projectId)))
            .returning({ id: s.id, title: s.title });
          if (!row) fail(`Scope item ${it.id} not found.`, { errorCode: "not_found", statusCode: 404 });
          out.push(row);
        } else {
          order += 10;
          const id = crypto.randomUUID();
          await tx.insert(s).values({ id, projectId, ...values, sortOrder: order, ownerEmail, orgId: project.orgId });
          out.push({ id, title: values.title });
        }
      }
      return out;
    });
    await refreshCheckFlags(projectId, ownerEmail, project.orgId);
    return { projectId, saved };
  },
});
