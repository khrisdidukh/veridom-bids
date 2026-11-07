import { fail } from "@agent-native/core/action";
import { accessFilter, assertAccess } from "@agent-native/core/sharing";
import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";

export type ActionCtx = { userEmail?: string | null; orgId?: string | null };

export function requireUser(ctx: ActionCtx | undefined): string {
  return ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
}

/** Resolves a project the caller may access, or fails with 404. */
export async function loadProject(
  projectId: string,
  role: "viewer" | "editor" = "viewer",
) {
  try {
    await assertAccess("bid-project", projectId, role);
  } catch {
    fail("Project not found.", { errorCode: "not_found", statusCode: 404 });
  }
  const [project] = await getDb()
    .select()
    .from(schema.bidProjects)
    .where(
      and(
        eq(schema.bidProjects.id, projectId),
        accessFilter(schema.bidProjects, schema.bidProjectShares),
      ),
    )
    .limit(1);
  if (!project)
    fail("Project not found.", { errorCode: "not_found", statusCode: 404 });
  return project;
}

/** Resolves a bid plus its project, checking access on the project. */
export async function loadBid(
  bidId: string,
  role: "viewer" | "editor" = "viewer",
) {
  const [bid] = await getDb()
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.id, bidId))
    .limit(1);
  if (!bid) fail("Quote not found.", { errorCode: "not_found", statusCode: 404 });
  const project = await loadProject(bid.projectId, role);
  return { bid, project };
}

type Scope = typeof schema.scopeItems.$inferSelect;
type Bid = typeof schema.bids.$inferSelect;
type Line = typeof schema.bidLines.$inferSelect;

export type CheckFinding = {
  bidId: string;
  scopeItemId: string | null;
  kind: "missing" | "excluded" | "price_high" | "price_low" | "quantity";
  severity: "high" | "medium" | "low";
  message: string;
  impact: number | null;
};

const round = (n: number) => Math.round(n * 100) / 100;
const median = (values: number[]) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

function lineUnitPrice(line: Line): number | null {
  if (line.unitPrice != null) return line.unitPrice;
  if (line.total != null && line.quantity) return line.total / line.quantity;
  return null;
}

function lineTotal(line: Line): number {
  if (line.total != null) return line.total;
  if (line.unitPrice != null && line.quantity != null)
    return line.unitPrice * line.quantity;
  return 0;
}

/**
 * The reference unit price used to fill a gap: the midpoint of the owner's
 * benchmark range, else the median of what the other contractors charge.
 */
export function referenceUnitPrice(
  item: Scope,
  linesByScope: Map<string, Line[]>,
  excludeBidId?: string,
): { price: number; basis: "benchmark" | "peers" } | null {
  if (item.benchmarkMin != null && item.benchmarkMax != null)
    return {
      price: (item.benchmarkMin + item.benchmarkMax) / 2,
      basis: "benchmark",
    };
  const peers = (linesByScope.get(item.id) ?? [])
    .filter((l) => l.bidId !== excludeBidId && l.coverage === "included")
    .map(lineUnitPrice)
    .filter((p): p is number => p != null && p > 0);
  const m = median(peers);
  return m == null ? null : { price: m, basis: "peers" };
}

/**
 * Deterministic comparison. It never guesses wording; it only reads the
 * mapped lines the agent or the user recorded.
 */
export function computeComparison(scope: Scope[], bids: Bid[], lines: Line[]) {
  const linesByScope = new Map<string, Line[]>();
  for (const line of lines) {
    if (!line.scopeItemId) continue;
    const list = linesByScope.get(line.scopeItemId) ?? [];
    list.push(line);
    linesByScope.set(line.scopeItemId, list);
  }

  const findings: CheckFinding[] = [];
  const totals = bids.map((bid) => {
    const own = lines.filter((l) => l.bidId === bid.id);
    const linesSum = round(
      own
        .filter((l) => l.coverage === "included")
        .reduce((s, l) => s + lineTotal(l), 0),
    );
    let gapCost = 0;
    let unpricedGaps = 0;

    if (bid.status === "received") {
      return {
        bidId: bid.id,
        quotedNet: bid.quotedNet,
        linesSum,
        gapCost: 0,
        unpricedGaps: 0,
        adjustedNet: bid.quotedNet,
      };
    }

    for (const item of scope) {
      const mapped = own.filter((l) => l.scopeItemId === item.id);
      const included = mapped.filter((l) => l.coverage === "included");
      const excluded = mapped.find((l) => l.coverage === "excluded");

      if (!included.length) {
        if (!item.required) continue;
        const ref = referenceUnitPrice(item, linesByScope, bid.id);
        const cost = ref ? round(ref.price * item.quantity) : null;
        if (cost != null) gapCost += cost;
        else unpricedGaps += 1;
        findings.push({
          bidId: bid.id,
          scopeItemId: item.id,
          kind: excluded ? "excluded" : "missing",
          severity: "high",
          message: excluded
            ? `Excluded: "${excluded.description}". You would still have to pay for ${item.title}${cost != null ? ` (about ${fmt(cost)} at ${ref?.basis === "benchmark" ? "your benchmark" : "the other quotes' median"})` : ""}.`
            : `Not in this quote: ${item.title}${cost != null ? ` — adding it costs about ${fmt(cost)} (${ref?.basis === "benchmark" ? "your benchmark" : "other quotes' median"})` : ""}.`,
          impact: cost,
        });
        continue;
      }

      const qty = included.reduce((s, l) => s + (l.quantity ?? 0), 0);
      const sameUnit = included.every(
        (l) => !l.unit || l.unit.toLowerCase() === item.unit.toLowerCase(),
      );
      if (
        sameUnit &&
        qty > 0 &&
        item.quantity > 0 &&
        Math.abs(qty - item.quantity) / item.quantity > 0.1
      ) {
        const unit = lineUnitPrice(included[0]!);
        const shortfall = item.quantity - qty;
        const impact = unit != null && shortfall > 0 ? round(unit * shortfall) : null;
        if (impact != null) gapCost += impact;
        findings.push({
          bidId: bid.id,
          scopeItemId: item.id,
          kind: "quantity",
          severity: shortfall > 0 ? "high" : "low",
          message: `${item.title}: quoted ${qty} ${item.unit}, your scope says ${item.quantity} ${item.unit}.${impact != null ? ` The missing ${round(shortfall)} ${item.unit} would add about ${fmt(impact)}.` : ""}`,
          impact,
        });
      }

      const unit = lineUnitPrice(included[0]!);
      if (unit != null && included.length === 1) {
        if (item.benchmarkMax != null && unit > item.benchmarkMax * 1.1) {
          findings.push({
            bidId: bid.id,
            scopeItemId: item.id,
            kind: "price_high",
            severity: unit > item.benchmarkMax * 1.3 ? "high" : "medium",
            message: `${item.title}: ${fmt(unit)}/${item.unit} is above your range of ${fmt(item.benchmarkMin ?? 0)}–${fmt(item.benchmarkMax)}.`,
            impact: round((unit - item.benchmarkMax) * item.quantity),
          });
        } else if (item.benchmarkMin != null && unit < item.benchmarkMin * 0.8) {
          findings.push({
            bidId: bid.id,
            scopeItemId: item.id,
            kind: "price_low",
            severity: "low",
            message: `${item.title}: ${fmt(unit)}/${item.unit} is well below your range — check what is left out.`,
            impact: null,
          });
        }
      }
    }

    const base = bid.quotedNet ?? linesSum;
    return {
      bidId: bid.id,
      quotedNet: bid.quotedNet,
      linesSum,
      gapCost: round(gapCost),
      unpricedGaps,
      adjustedNet: round(base + gapCost),
    };
  });

  return { totals, findings };
}

export async function loadProjectData(projectId: string) {
  const db = getDb();
  const [scope, bids, lines] = await Promise.all([
    db
      .select()
      .from(schema.scopeItems)
      .where(eq(schema.scopeItems.projectId, projectId))
      .orderBy(asc(schema.scopeItems.sortOrder), asc(schema.scopeItems.createdAt))
      .limit(300),
    db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.projectId, projectId))
      .orderBy(asc(schema.bids.createdAt))
      .limit(20),
    db
      .select()
      .from(schema.bidLines)
      .where(eq(schema.bidLines.projectId, projectId))
      .orderBy(asc(schema.bidLines.createdAt))
      .limit(2000),
  ]);
  return { scope, bids, lines };
}

/**
 * Re-runs the deterministic checks and replaces open check-generated flags.
 * Flags the user dismissed or resolved stay as they are and are not
 * re-raised for the same bid, scope item and kind.
 */
export async function refreshCheckFlags(
  projectId: string,
  ownerEmail: string,
  orgId: string | null,
) {
  const data = await loadProjectData(projectId);
  const { findings, totals } = computeComparison(
    data.scope,
    data.bids,
    data.lines,
  );
  const db = getDb();
  const f = schema.bidFlags;
  return db.transaction(async (tx) => {
    const settled = await tx
      .select({ bidId: f.bidId, scopeItemId: f.scopeItemId, kind: f.kind })
      .from(f)
      .where(
        and(
          eq(f.projectId, projectId),
          eq(f.source, "check"),
          inArray(f.status, ["dismissed", "resolved"]),
        ),
      );
    const key = (x: { bidId: string; scopeItemId: string | null; kind: string }) =>
      `${x.bidId}|${x.scopeItemId ?? ""}|${x.kind}`;
    const settledKeys = new Set(settled.map(key));
    await tx
      .delete(f)
      .where(
        and(
          eq(f.projectId, projectId),
          eq(f.source, "check"),
          eq(f.status, "open"),
        ),
      );
    const fresh = findings.filter((x) => !settledKeys.has(key(x)));
    if (fresh.length) {
      await tx.insert(f).values(
        fresh.map((x) => ({
          id: crypto.randomUUID(),
          projectId,
          bidId: x.bidId,
          scopeItemId: x.scopeItemId,
          kind: x.kind,
          severity: x.severity,
          message: x.message,
          impact: x.impact,
          source: "check" as const,
          status: "open" as const,
          ownerEmail,
          orgId,
        })),
      );
    }
    return { flagsRaised: fresh.length, totals };
  });
}
