import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadProject, refreshCheckFlags, requireUser } from "../server/lib/bids.js";

export default defineAction({
  description: "Remove a scope item. Quote lines mapped to it become unmapped.",
  schema: z.object({ id: z.string().describe("Scope item id") }),
  run: async ({ id }, ctx) => {
    const ownerEmail = requireUser(ctx);
    const s = schema.scopeItems;
    const [row] = await getDb().select({ projectId: s.projectId }).from(s).where(eq(s.id, id)).limit(1);
    if (!row) fail("Scope item not found.", { errorCode: "not_found", statusCode: 404 });
    const project = await loadProject(row.projectId, "editor");
    await getDb().delete(s).where(eq(s.id, id));
    await refreshCheckFlags(project.id, ownerEmail, project.orgId);
    return { id, deleted: true };
  },
});
