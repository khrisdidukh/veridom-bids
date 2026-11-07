import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  computeComparison,
  loadProject,
  loadProjectData,
} from "../server/lib/bids.js";

export default defineAction({
  description:
    "Read the full price comparison (Preisspiegel) of a project: scope items with benchmark ranges, every quote's header and mapped lines, open/settled flags, drafted questions, and per-quote totals including adjustedNet = quoted net + the cost of filling the quote's gaps. Use this before judging or answering questions about the quotes.",
  schema: z.object({
    projectId: z.string().describe("Project id from list-bid-projects"),
  }),
  http: { method: "GET" },
  readOnly: true,
  link: ({ args }) => ({
    url: buildDeepLink({ view: "bids", to: `/bids/${encodeURIComponent(args.projectId)}`, params: { projectId: args.projectId } }),
    label: "Open price comparison",
  }),
  run: async ({ projectId }) => {
    const project = await loadProject(projectId);
    const data = await loadProjectData(projectId);
    const db = getDb();
    const [flags, questions] = await Promise.all([
      db
        .select({
          id: schema.bidFlags.id,
          bidId: schema.bidFlags.bidId,
          scopeItemId: schema.bidFlags.scopeItemId,
          kind: schema.bidFlags.kind,
          severity: schema.bidFlags.severity,
          message: schema.bidFlags.message,
          impact: schema.bidFlags.impact,
          source: schema.bidFlags.source,
          status: schema.bidFlags.status,
        })
        .from(schema.bidFlags)
        .where(eq(schema.bidFlags.projectId, projectId))
        .orderBy(asc(schema.bidFlags.createdAt))
        .limit(500),
      db
        .select({
          id: schema.bidQuestions.id,
          bidId: schema.bidQuestions.bidId,
          flagId: schema.bidQuestions.flagId,
          text: schema.bidQuestions.text,
          status: schema.bidQuestions.status,
        })
        .from(schema.bidQuestions)
        .where(eq(schema.bidQuestions.projectId, projectId))
        .orderBy(asc(schema.bidQuestions.createdAt))
        .limit(300),
    ]);
    const { totals } = computeComparison(data.scope, data.bids, data.lines);
    return {
      project: {
        id: project.id,
        name: project.name,
        location: project.location,
        description: project.description,
        currency: project.currency,
      },
      scope: data.scope.map((s) => ({
        id: s.id,
        trade: s.trade,
        title: s.title,
        unit: s.unit,
        quantity: s.quantity,
        required: s.required,
        benchmarkMin: s.benchmarkMin,
        benchmarkMax: s.benchmarkMax,
        notes: s.notes,
      })),
      bids: data.bids.map((b) => ({
        id: b.id,
        contractorName: b.contractorName,
        contractorEmail: b.contractorEmail,
        quoteRef: b.quoteRef,
        quoteDate: b.quoteDate,
        validUntil: b.validUntil,
        quotedNet: b.quotedNet,
        vatRate: b.vatRate,
        paymentTerms: b.paymentTerms,
        warrantyMonths: b.warrantyMonths,
        startDate: b.startDate,
        durationDays: b.durationDays,
        fileName: b.fileName,
        status: b.status,
      })),
      lines: data.lines.map((l) => ({
        id: l.id,
        bidId: l.bidId,
        scopeItemId: l.scopeItemId,
        position: l.position,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        total: l.total,
        coverage: l.coverage,
        note: l.note,
        editedBy: l.editedBy,
      })),
      flags,
      questions,
      totals,
    };
  },
});
