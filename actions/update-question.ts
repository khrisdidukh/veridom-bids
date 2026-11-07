import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadProject } from "../server/lib/bids.js";

export default defineAction({
  description: "Edit a drafted question, approve it, or move it back to draft.",
  schema: z.object({
    id: z.string().describe("Question id"),
    text: z.string().min(1).max(800).optional().describe("New wording"),
    status: z.enum(["draft", "approved"]).optional().describe("Approval status"),
  }),
  run: async ({ id, text, status }) => {
    const q = schema.bidQuestions;
    const [row] = await getDb().select({ projectId: q.projectId }).from(q).where(eq(q.id, id)).limit(1);
    if (!row) fail("Question not found.", { errorCode: "not_found", statusCode: 404 });
    await loadProject(row.projectId, "editor");
    const patch: Record<string, string> = {};
    if (text !== undefined) patch.text = text.trim();
    if (status !== undefined) patch.status = status;
    if (Object.keys(patch).length) await getDb().update(q).set(patch).where(eq(q.id, id));
    return { id, ...patch };
  },
});
