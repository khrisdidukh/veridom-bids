import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadProject, refreshCheckFlags, requireUser } from "../server/lib/bids.js";

export default defineAction({
  description:
    "Re-run the deterministic checks on every quote: missing or excluded scope items (priced at the owner's benchmark or the other quotes' median), short quantities, and unit prices outside the benchmark range. Returns per-quote totals with adjustedNet.",
  schema: z.object({ projectId: z.string().describe("Project id") }),
  run: async ({ projectId }, ctx) => {
    const ownerEmail = requireUser(ctx);
    const project = await loadProject(projectId, "editor");
    return refreshCheckFlags(project.id, ownerEmail, project.orgId);
  },
});
