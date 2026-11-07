import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadBid, requireUser } from "../server/lib/bids.js";

export default defineAction({
  description:
    "Raise a judgement flag the checks cannot see, e.g. risky payment terms (large advance), short warranty, vague lump sums, missing dates, or a clause worth negotiating. Keep the message one or two plain sentences and cite the quote's wording.",
  schema: z.object({
    bidId: z.string().describe("Quote id"),
    kind: z.enum(["terms", "other", "price_high", "price_low", "quantity", "missing", "excluded"]).describe("Flag type"),
    severity: z.enum(["high", "medium", "low"]).describe("How much it matters to the owner"),
    message: z.string().min(1).max(500).describe("Plain-language finding"),
    scopeItemId: z.string().nullable().optional().describe("Scope item it concerns, if any"),
    impact: z.coerce.number().nullable().optional().describe("Estimated EUR effect, only when you can justify it"),
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    const { bid, project } = await loadBid(args.bidId, "editor");
    const id = crypto.randomUUID();
    await getDb().insert(schema.bidFlags).values({
      id,
      projectId: project.id,
      bidId: bid.id,
      scopeItemId: args.scopeItemId ?? null,
      kind: args.kind,
      severity: args.severity,
      message: args.message,
      impact: args.impact ?? null,
      source: "agent",
      status: "open",
      ownerEmail,
      orgId: project.orgId,
    });
    return { id, bidId: bid.id, kind: args.kind };
  },
});
