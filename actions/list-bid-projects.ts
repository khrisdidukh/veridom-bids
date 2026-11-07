import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { accessFilter } from "@agent-native/core/sharing";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "List the renovation projects (bid comparisons) the current user can open, newest first.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "bids", to: "/bids" }),
    label: "Open bid comparisons",
  }),
  run: async () => {
    const p = schema.bidProjects;
    const rows = await getDb()
      .select({
        id: p.id,
        name: p.name,
        location: p.location,
        createdAt: p.createdAt,
      })
      .from(p)
      .where(accessFilter(p, schema.bidProjectShares))
      .orderBy(desc(p.createdAt))
      .limit(100);
    return { projects: rows };
  },
});
