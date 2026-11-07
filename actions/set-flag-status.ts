import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadProject } from "../server/lib/bids.js";

export default defineAction({
  description:
    "Mark a flag resolved (the contractor answered or it was fixed), dismissed (owner accepts it), or open again. Settled check flags are not raised again.",
  schema: z.object({
    id: z.string().describe("Flag id"),
    status: z.enum(["open", "resolved", "dismissed"]).describe("New status"),
  }),
  run: async ({ id, status }) => {
    const f = schema.bidFlags;
    const [row] = await getDb().select({ projectId: f.projectId }).from(f).where(eq(f.id, id)).limit(1);
    if (!row) fail("Flag not found.", { errorCode: "not_found", statusCode: 404 });
    await loadProject(row.projectId, "editor");
    await getDb().update(f).set({ status }).where(eq(f.id, id));
    return { id, status };
  },
});
