import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadBid, requireUser } from "../server/lib/bids.js";

export default defineAction({
  description:
    "Draft clarification questions for one contractor, one per issue, in the language of their quote (German for Austrian quotes), polite and specific (cite the position). They stay drafts until the owner approves them.",
  schema: z.object({
    bidId: z.string().describe("Quote id"),
    questions: z
      .array(z.object({
        text: z.string().min(1).max(800).describe("One question"),
        flagId: z.string().nullable().optional().describe("Flag this question addresses"),
      }))
      .min(1)
      .max(20)
      .describe("Questions to add"),
  }),
  run: async ({ bidId, questions }, ctx) => {
    const ownerEmail = requireUser(ctx);
    const { bid, project } = await loadBid(bidId, "editor");
    const flagIds = [...new Set(questions.map((q) => q.flagId).filter((x): x is string => !!x))];
    if (flagIds.length) {
      const f = schema.bidFlags;
      const known = await getDb().select({ id: f.id }).from(f).where(and(eq(f.bidId, bid.id), inArray(f.id, flagIds)));
      if (known.length !== flagIds.length) fail("A flagId does not belong to this quote.", { errorCode: "unknown_flag" });
    }
    const rows = questions.map((q) => ({
      id: crypto.randomUUID(),
      projectId: project.id,
      bidId: bid.id,
      flagId: q.flagId ?? null,
      text: q.text.trim(),
      status: "draft" as const,
      ownerEmail,
      orgId: project.orgId,
    }));
    await getDb().insert(schema.bidQuestions).values(rows);
    return { bidId: bid.id, ids: rows.map((r) => r.id) };
  },
});
