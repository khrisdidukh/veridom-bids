import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadProject } from "../server/lib/bids.js";

export default defineAction({
  description: "Delete a drafted question.",
  schema: z.object({ id: z.string().describe("Question id") }),
  run: async ({ id }) => {
    const q = schema.bidQuestions;
    const [row] = await getDb().select({ projectId: q.projectId }).from(q).where(eq(q.id, id)).limit(1);
    if (!row) fail("Question not found.", { errorCode: "not_found", statusCode: 404 });
    await loadProject(row.projectId, "editor");
    await getDb().delete(q).where(eq(q.id, id));
    return { id, deleted: true };
  },
});
