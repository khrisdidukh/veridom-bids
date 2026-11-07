import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadBid, refreshCheckFlags, requireUser } from "../server/lib/bids.js";

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

export default defineAction({
  description:
    "Update a quote's header: totals, VAT, terms, warranty, dates, or review status. Amounts are net EUR. Dates are YYYY-MM-DD.",
  schema: z.object({
    bidId: z.string().describe("Quote id"),
    contractorName: z.string().min(1).max(160).optional().describe("Company name"),
    contractorEmail: z.string().email().nullable().optional().describe("Contractor email"),
    quoteRef: z.string().max(80).nullable().optional().describe("Quote number on the document"),
    quoteDate: dateText.describe("Quote date, YYYY-MM-DD"),
    validUntil: dateText.describe("Offer valid until, YYYY-MM-DD"),
    quotedNet: z.coerce.number().min(0).nullable().optional().describe("Quote total excluding VAT, EUR"),
    vatRate: z.coerce.number().min(0).max(30).nullable().optional().describe("VAT percent, e.g. 20"),
    paymentTerms: z.string().max(300).nullable().optional().describe("Payment terms as written, shortened"),
    warrantyMonths: z.coerce.number().int().min(0).max(240).nullable().optional().describe("Warranty in months"),
    startDate: dateText.describe("Earliest start, YYYY-MM-DD"),
    durationDays: z.coerce.number().int().min(0).max(1000).nullable().optional().describe("Working days needed"),
    status: z.enum(["received", "extracted", "reviewed"]).optional().describe("'reviewed' once the owner checked it"),
  }),
  run: async ({ bidId, ...patch }, ctx) => {
    const ownerEmail = requireUser(ctx);
    const { project } = await loadBid(bidId, "editor");
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length) await getDb().update(schema.bids).set(clean).where(eq(schema.bids.id, bidId));
    const { totals } = await refreshCheckFlags(project.id, ownerEmail, project.orgId);
    return { id: bidId, updated: Object.keys(clean), totals: totals.find((t) => t.bidId === bidId) ?? null };
  },
});
