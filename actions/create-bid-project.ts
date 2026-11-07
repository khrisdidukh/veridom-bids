import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireUser } from "../server/lib/bids.js";

export default defineAction({
  description:
    "Create a renovation project to compare contractor quotes for. Add its scope with save-scope-items next.",
  schema: z.object({
    name: z.string().min(1).max(120).describe('Project name, e.g. "Bathroom renovation, Vienna 1030"'),
    location: z.string().max(120).optional().describe("City or address, optional"),
    description: z.string().max(2000).optional().describe("What the job is, in the owner's words"),
  }),
  link: ({ result }) => ({
    url: buildDeepLink({ view: "bids", to: `/bids/${encodeURIComponent(result.id)}`, params: { projectId: result.id } }),
    label: `Open ${result.name}`,
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const row = {
      id: crypto.randomUUID(),
      name: args.name.trim(),
      location: args.location?.trim() || null,
      description: args.description?.trim() || null,
      ownerEmail,
      orgId,
      visibility: orgId ? ("org" as const) : ("private" as const),
    };
    await getDb().insert(schema.bidProjects).values(row);
    return { id: row.id, name: row.name };
  },
});
