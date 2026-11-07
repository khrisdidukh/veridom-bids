import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadBid, refreshCheckFlags, requireUser } from "../server/lib/bids.js";

export default defineAction({
  description: "Remove a quote with its lines, flags and questions from the comparison.",
  schema: z.object({ bidId: z.string().describe("Quote id") }),
  run: async ({ bidId }, ctx) => {
    const ownerEmail = requireUser(ctx);
    const { project } = await loadBid(bidId, "editor");
    await getDb().delete(schema.bids).where(eq(schema.bids.id, bidId));
    await refreshCheckFlags(project.id, ownerEmail, project.orgId);
    return { id: bidId, deleted: true };
  },
});
