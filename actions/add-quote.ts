import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { loadProject, requireUser } from "../server/lib/bids.js";

export default defineAction({
  description:
    "Register a contractor quote with its raw text (from an uploaded PDF or pasted text). It starts as 'received'; read it with read-quote-text and record its lines with record-quote-lines.",
  schema: z.object({
    projectId: z.string().describe("Project id"),
    contractorName: z.string().min(1).max(160).describe("Company name as written on the quote"),
    contractorEmail: z.string().email().optional().describe("Contractor email if known"),
    fileName: z.string().max(200).optional().describe("Original file name"),
    sourceText: z.string().min(20).max(120000).describe("Full plain text of the quote"),
  }),
  link: ({ args }) => ({
    url: buildDeepLink({ view: "bids", to: `/bids/${encodeURIComponent(args.projectId)}`, params: { projectId: args.projectId } }),
    label: "Open price comparison",
  }),
  run: async (args, ctx) => {
    const ownerEmail = requireUser(ctx);
    const project = await loadProject(args.projectId, "editor");
    const b = schema.bids;
    const [countRow] = await getDb()
      .select({ n: sql<number>`count(*)` })
      .from(b)
      .where(eq(b.projectId, project.id));
    if (Number(countRow?.n ?? 0) >= 8) fail("A comparison holds at most 8 quotes.", { errorCode: "too_many_quotes", statusCode: 409 });
    const [dupe] = await getDb()
      .select({ id: b.id })
      .from(b)
      .where(and(eq(b.projectId, project.id), eq(b.contractorName, args.contractorName.trim())))
      .limit(1);
    if (dupe) fail(`A quote from ${args.contractorName} is already in this comparison.`, { errorCode: "duplicate_quote", statusCode: 409, details: { bidId: dupe.id } });
    const id = crypto.randomUUID();
    await getDb().insert(b).values({
      id,
      projectId: project.id,
      contractorName: args.contractorName.trim(),
      contractorEmail: args.contractorEmail ?? null,
      fileName: args.fileName ?? null,
      sourceText: args.sourceText,
      status: "received",
      ownerEmail,
      orgId: project.orgId,
    });
    return { id, projectId: project.id, contractorName: args.contractorName.trim(), status: "received" as const };
  },
});
