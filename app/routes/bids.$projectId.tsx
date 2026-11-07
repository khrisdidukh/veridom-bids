import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconFileUpload,
  IconLoader2,
  IconMail,
  IconRefresh,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fileToText } from "@/lib/pdf-text";
import { cn } from "@/lib/utils";

type Coverage = "included" | "excluded" | "optional" | "unclear";
type Scope = {
  id: string;
  trade: string;
  title: string;
  unit: string;
  quantity: number;
  required: boolean;
  benchmarkMin: number | null;
  benchmarkMax: number | null;
  notes: string | null;
};
type Bid = {
  id: string;
  contractorName: string;
  contractorEmail: string | null;
  quoteRef: string | null;
  quotedNet: number | null;
  vatRate: number | null;
  paymentTerms: string | null;
  warrantyMonths: number | null;
  validUntil: string | null;
  startDate: string | null;
  durationDays: number | null;
  fileName: string | null;
  status: "received" | "extracted" | "reviewed";
};
type Line = {
  id: string;
  bidId: string;
  scopeItemId: string | null;
  position: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
  coverage: Coverage;
  note: string | null;
  editedBy: "agent" | "user";
};
type Flag = {
  id: string;
  bidId: string;
  scopeItemId: string | null;
  kind: string;
  severity: "high" | "medium" | "low";
  message: string;
  impact: number | null;
  source: "check" | "agent" | "user";
  status: "open" | "resolved" | "dismissed";
};
type Question = {
  id: string;
  bidId: string;
  flagId: string | null;
  text: string;
  status: "draft" | "approved";
};
type Totals = {
  bidId: string;
  quotedNet: number | null;
  linesSum: number;
  gapCost: number;
  unpricedGaps: number;
  adjustedNet: number | null;
};
type Comparison = {
  project: { id: string; name: string; location: string | null; description: string | null };
  scope: Scope[];
  bids: Bid[];
  lines: Line[];
  flags: Flag[];
  questions: Question[];
  totals: Totals[];
};

const eur = (n: number | null | undefined, digits = 0) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(n);

const HAZARD =
  "repeating-linear-gradient(135deg, rgb(234 179 8 / 0.22) 0 6px, transparent 6px 12px)";

function lineUnit(l: Line) {
  if (l.unitPrice != null) return l.unitPrice;
  if (l.total != null && l.quantity) return l.total / l.quantity;
  return null;
}

export default function PriceComparisonRoute() {
  const t = useT();
  const { projectId = "" } = useParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const { data, isPending, error } = useActionQuery("get-price-comparison", { projectId });
  const cmp = data as Comparison | undefined;

  const addQuote = useActionMutation("add-quote");
  const runChecks = useActionMutation("run-checks", {
    onSuccess: () => toast.success(t("bids.checksDone")),
    onError: (e) => toast.error(actionErrorMessage(e) ?? t("bids.genericError")),
  });

  async function onFiles(files: FileList | null) {
    if (!files?.length || !cmp) return;
    setReading(true);
    try {
      const added: { bidId: string; file: string }[] = [];
      for (const file of Array.from(files)) {
        const text = await fileToText(file);
        if (text.trim().length < 20) {
          toast.error(t("bids.noText", { name: file.name }));
          continue;
        }
        const placeholder = file.name.replace(/\.[^.]+$/, "").slice(0, 160);
        const bid = await addQuote.mutateAsync({
          projectId,
          contractorName: placeholder,
          fileName: file.name,
          sourceText: text.slice(0, 120000),
        });
        added.push({ bidId: bid.id, file: file.name });
      }
      // One agent turn for the whole batch, so quotes are read in order
      // instead of racing each other in parallel chats.
      if (added.length) {
        sendToAgentChat({
          message: t("bids.agentExtract", { name: added.map((a) => a.file).join(", ") }),
          context: JSON.stringify({ projectId, quotes: added }),
          contextLabel: added.map((a) => a.file).join(", "),
          submit: true,
          openSidebar: true,
        });
      }
    } catch (e) {
      toast.error(actionErrorMessage(e) ?? t("bids.uploadFailed"));
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (isPending) {
    return (
      <main className="flex flex-col gap-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </main>
    );
  }
  if (error || !cmp) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">{t("bids.notFound")}</p>
        <Link className="mt-3 inline-block text-sm underline" to="/bids">
          {t("bids.back")}
        </Link>
      </main>
    );
  }

  const totalsBy = new Map(cmp.totals.map((x) => [x.bidId, x]));
  const ranked = cmp.bids
    .filter((b) => b.status !== "received" && totalsBy.get(b.id)?.adjustedNet != null)
    .sort((a, b) => (totalsBy.get(a.id)!.adjustedNet ?? 0) - (totalsBy.get(b.id)!.adjustedNet ?? 0));
  const cheapestOnPaper = [...ranked].sort(
    (a, b) => (a.quotedNet ?? Infinity) - (b.quotedNet ?? Infinity),
  )[0];
  const realBest = ranked[0];
  const openFlags = cmp.flags.filter((f) => f.status === "open");

  return (
    <main className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/bids" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <IconArrowLeft className="size-3.5" />
            {t("bids.back")}
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{cmp.project.name}</h1>
          {cmp.project.description ? (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">{cmp.project.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            multiple
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={reading}>
            {reading ? <IconLoader2 className="size-4 animate-spin" /> : <IconFileUpload className="size-4" />}
            {reading ? t("bids.reading") : t("bids.addQuote")}
          </Button>
          <Button
            variant="outline"
            disabled={!cmp.bids.length}
            onClick={() =>
              sendToAgentChat({
                message: t("bids.agentVerdict"),
                context: JSON.stringify({ projectId }),
                submit: true,
                openSidebar: true,
              })
            }
          >
            <IconSparkles className="size-4" />
            {t("bids.askVerdict")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("bids.rerunChecks")}
            title={t("bids.rerunChecks")}
            disabled={runChecks.isPending}
            onClick={() => runChecks.mutate({ projectId })}
          >
            <IconRefresh className={cn("size-4", runChecks.isPending && "animate-spin")} />
          </Button>
        </div>
      </header>

      {cmp.bids.length ? (
        <section aria-label={t("bids.verdictLabel")} className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
          {cmp.bids.map((bid) => (
            <VerdictCard
              key={bid.id}
              bid={bid}
              totals={totalsBy.get(bid.id)}
              flags={openFlags.filter((f) => f.bidId === bid.id)}
              isRealBest={realBest?.id === bid.id && ranked.length > 1}
              isPaperBest={cheapestOnPaper?.id === bid.id && ranked.length > 1}
              projectId={projectId}
            />
          ))}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border-2 border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <IconFileUpload className="mx-auto mb-2 size-6" />
          {t("bids.emptyQuotes")}
        </button>
      )}

      <Matrix cmp={cmp} />

      {cmp.bids.length ? <ContractorPanels cmp={cmp} projectId={projectId} /> : null}
    </main>
  );
}

function VerdictCard({
  bid,
  totals,
  flags,
  isRealBest,
  isPaperBest,
  projectId,
}: {
  bid: Bid;
  totals: Totals | undefined;
  flags: Flag[];
  isRealBest: boolean;
  isPaperBest: boolean;
  projectId: string;
}) {
  const t = useT();
  const pending = bid.status === "received";
  const gap = totals?.gapCost ?? 0;
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-4",
        isRealBest ? "border-emerald-600/60 ring-1 ring-emerald-600/30" : "border-border",
      )}
    >
      <div className="flex min-h-5 flex-wrap gap-1">
        {isRealBest ? (
          <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {t("bids.realBest")}
          </span>
        ) : null}
        {isPaperBest && !isRealBest ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            {t("bids.paperBest")}
          </span>
        ) : null}
      </div>
      <h2 className="line-clamp-2 text-sm font-semibold leading-snug" title={bid.contractorName}>
        {bid.contractorName}
      </h2>
      {pending ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" />
          {t("bids.extracting")}
          <Button
            size="sm"
            variant="link"
            className="h-auto p-0"
            onClick={() =>
              sendToAgentChat({
                message: t("bids.agentExtract", { name: bid.fileName ?? bid.contractorName }),
                context: JSON.stringify({ projectId, bidId: bid.id }),
                submit: true,
                openSidebar: true,
              })
            }
          >
            {t("bids.retryExtract")}
          </Button>
        </div>
      ) : (
        <>
          <div>
            <p className="text-[11px] text-muted-foreground">{t("bids.realCost")}</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{eur(totals?.adjustedNet)}</p>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {t("bids.quoted")} {eur(bid.quotedNet)}
            {gap > 0 ? (
              <span className="whitespace-nowrap text-amber-700 dark:text-amber-400"> + {eur(gap)} {t("bids.toComplete")}</span>
            ) : null}
            {totals?.unpricedGaps ? (
              <span> · {t("bids.unpriced", { count: totals.unpricedGaps })}</span>
            ) : null}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <IconAlertTriangle className={cn("size-3.5", flags.some((f) => f.severity === "high") && "text-amber-600")} />
              {t("bids.openIssues", { count: flags.length })}
            </span>
            {bid.warrantyMonths != null ? (
              <span className="whitespace-nowrap">{t("bids.warranty", { months: bid.warrantyMonths })}</span>
            ) : null}
          </p>
        </>
      )}
    </article>
  );
}

function Matrix({ cmp }: { cmp: Comparison }) {
  const t = useT();
  const bids = cmp.bids;
  if (!cmp.scope.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {t("bids.emptyScope")}
      </p>
    );
  }
  const linesFor = (bidId: string, scopeId: string) =>
    cmp.lines.filter((l) => l.bidId === bidId && l.scopeItemId === scopeId);
  const flagsFor = (bidId: string, scopeId: string) =>
    cmp.flags.filter((f) => f.bidId === bidId && f.scopeItemId === scopeId && f.status === "open");
  const totalsBy = new Map(cmp.totals.map((x) => [x.bidId, x]));
  let lastTrade = "";

  return (
    <section aria-label={t("bids.matrixLabel")} className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="w-[34%] px-3 py-2.5 text-xs font-medium text-muted-foreground">
              {t("bids.colScope")}
            </th>
            {bids.map((b) => (
              <th key={b.id} scope="col" className="px-3 py-2.5 text-xs font-medium">
                <span className="line-clamp-1" title={b.contractorName}>{b.contractorName}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cmp.scope.map((s) => {
            const showTrade = s.trade !== lastTrade;
            lastTrade = s.trade;
            return [
              showTrade ? (
                <tr key={`${s.id}-trade`} className="bg-muted/40">
                  <th colSpan={bids.length + 1} scope="colgroup" className="px-3 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                    {s.trade}
                  </th>
                </tr>
              ) : null,
              <tr key={s.id} className="border-b border-border/70 align-top last:border-0">
                <th scope="row" className="px-3 py-2.5 text-left font-normal">
                  <ScopeCell item={s} projectId={cmp.project.id} />
                </th>
                {bids.map((b) => (
                  <td key={b.id} className="p-1.5">
                    <QuoteCell
                      bid={b}
                      scope={s}
                      lines={linesFor(b.id, s.id)}
                      flags={flagsFor(b.id, s.id)}
                    />
                  </td>
                ))}
              </tr>,
            ];
          })}
          <tr className="border-t-2 border-border">
            <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              {t("bids.extras")}
            </th>
            {bids.map((b) => {
              const extras = cmp.lines.filter((l) => l.bidId === b.id && !l.scopeItemId && l.coverage === "included");
              const sum = extras.reduce((a, l) => a + (l.total ?? 0), 0);
              return (
                <td key={b.id} className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                  {extras.length ? (
                    <span title={extras.map((l) => l.description).join("\n")}>
                      {t("bids.extrasCount", { count: extras.length })} · {eur(sum)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              );
            })}
          </tr>
          <tr>
            <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              {t("bids.quotedNet")}
            </th>
            {bids.map((b) => (
              <td key={b.id} className="px-3 py-2 tabular-nums">{eur(b.quotedNet)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              {t("bids.gapCost")}
            </th>
            {bids.map((b) => {
              const g = totalsBy.get(b.id)?.gapCost ?? 0;
              return (
                <td key={b.id} className={cn("px-3 py-2 tabular-nums", g > 0 && "text-amber-700 dark:text-amber-400")}>
                  {g > 0 ? `+ ${eur(g)}` : "—"}
                </td>
              );
            })}
          </tr>
          <tr className="bg-muted/40">
            <th scope="row" className="px-3 py-2.5 text-left text-sm font-semibold">
              {t("bids.realCost")}
            </th>
            {bids.map((b) => (
              <td key={b.id} className="px-3 py-2.5 text-base font-semibold tabular-nums">
                {b.status === "received" ? "…" : eur(totalsBy.get(b.id)?.adjustedNet)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function ScopeCell({ item, projectId }: { item: Scope; projectId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(item.quantity));
  const [min, setMin] = useState(item.benchmarkMin?.toString() ?? "");
  const [max, setMax] = useState(item.benchmarkMax?.toString() ?? "");
  const save = useActionMutation("save-scope-items", {
    onSuccess: () => setOpen(false),
    onError: (e) => toast.error(actionErrorMessage(e) ?? t("bids.genericError")),
  });
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQty(String(item.quantity));
          setMin(item.benchmarkMin?.toString() ?? "");
          setMax(item.benchmarkMax?.toString() ?? "");
        }
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="block font-medium leading-snug">{item.title}</span>
          <span className="block text-xs tabular-nums text-muted-foreground">
            {item.quantity === 1 ? item.unit : `${item.quantity} ${item.unit}`}
            {item.benchmarkMin != null && item.benchmarkMax != null
              ? ` · ${t("bids.fair")} ${eur(item.benchmarkMin)}–${eur(item.benchmarkMax)}${item.quantity === 1 ? "" : `/${item.unit}`}`
              : ""}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              projectId,
              items: [
                {
                  id: item.id,
                  trade: item.trade,
                  title: item.title,
                  unit: item.unit,
                  quantity: Number(qty.replace(",", ".")) || 0,
                  required: item.required,
                  benchmarkMin: num(min),
                  benchmarkMax: num(max),
                  notes: item.notes,
                },
              ],
            });
          }}
        >
          <p className="text-sm font-medium">{item.title}</p>
          <div className="grid gap-1.5">
            <Label htmlFor={`q-${item.id}`}>{t("bids.quantity")} ({item.unit})</Label>
            <Input id={`q-${item.id}`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`min-${item.id}`}>{t("bids.fairMin")}</Label>
              <Input id={`min-${item.id}`} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`max-${item.id}`}>{t("bids.fairMax")}</Label>
              <Input id={`max-${item.id}`} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("bids.benchmarkHint")}</p>
          <Button type="submit" size="sm" disabled={save.isPending}>
            {t("bids.save")}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function QuoteCell({
  bid,
  scope,
  lines,
  flags,
}: {
  bid: Bid;
  scope: Scope;
  lines: Line[];
  flags: Flag[];
}) {
  const t = useT();
  if (bid.status === "received") {
    return <Skeleton className="h-10 rounded-md" />;
  }
  const included = lines.filter((l) => l.coverage === "included");
  const excluded = lines.find((l) => l.coverage === "excluded");
  const gap = flags.find((f) => f.kind === "missing" || f.kind === "excluded");
  const priceFlag = flags.find((f) => f.kind === "price_high" || f.kind === "price_low");
  const qtyFlag = flags.find((f) => f.kind === "quantity");
  const total = included.reduce((a, l) => a + (l.total ?? 0), 0);
  const unit = included.length === 1 ? lineUnit(included[0]!) : null;

  const body = gap || (!included.length && scope.required) ? (
    <div className="rounded-md px-2.5 py-2" style={{ backgroundImage: HAZARD }}>
      <span className="block text-xs font-semibold text-amber-800 dark:text-amber-300">
        {excluded ? t("bids.excluded") : t("bids.missing")}
      </span>
      {gap?.impact != null ? (
        <span className="block text-xs tabular-nums text-amber-800/80 dark:text-amber-300/80">
          ≈ {eur(gap.impact)} {t("bids.toAdd")}
        </span>
      ) : null}
    </div>
  ) : !included.length ? (
    <div className="px-2.5 py-2 text-xs text-muted-foreground">
      {lines[0] ? t(`bids.coverage.${lines[0].coverage}`) : "—"}
    </div>
  ) : (
    <div
      className={cn(
        "rounded-md px-2.5 py-2",
        priceFlag?.kind === "price_high" && "outline outline-1 -outline-offset-1 outline-rose-500/70",
        qtyFlag && "outline outline-1 -outline-offset-1 outline-dashed outline-amber-500/80",
      )}
    >
      <span className="block font-medium tabular-nums">{eur(total)}</span>
      <span className="line-clamp-1 text-xs tabular-nums text-muted-foreground" title={included.map((l) => l.description).join("\n")}>
        {unit == null
          ? t("bids.positions", { count: included.length })
          : scope.quantity === 1
            ? included[0]?.description
            : `${eur(unit, unit < 100 ? 2 : 0)}/${scope.unit}`}
        {priceFlag?.kind === "price_high" ? <span className="text-rose-600 dark:text-rose-400"> · {t("bids.aboveRange")}</span> : null}
        {qtyFlag ? <span className="text-amber-700 dark:text-amber-400"> · {t("bids.shortQty")}</span> : null}
      </span>
    </div>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="block w-full rounded-md text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${bid.contractorName}: ${scope.title}`}
        >
          {body}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem]" align="start">
        <LineEditor bid={bid} scope={scope} lines={lines} flags={flags} />
      </PopoverContent>
    </Popover>
  );
}

function LineEditor({ bid, scope, lines, flags }: { bid: Bid; scope: Scope; lines: Line[]; flags: Flag[] }) {
  const t = useT();
  const update = useActionMutation("update-quote-line", {
    onError: (e) => toast.error(actionErrorMessage(e) ?? t("bids.genericError")),
    onSuccess: () => toast.success(t("bids.lineSaved")),
  });
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-xs text-muted-foreground">{bid.contractorName}</p>
        <p className="text-sm font-medium">{scope.title}</p>
      </div>
      {flags.map((f) => (
        <p key={f.id} className="rounded-md bg-amber-500/10 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-200">
          {f.message}
        </p>
      ))}
      {lines.length ? (
        lines.map((l) => <LineRow key={l.id} line={l} onSave={(patch) => update.mutate({ id: l.id, ...patch })} busy={update.isPending} />)
      ) : (
        <p className="text-xs text-muted-foreground">{t("bids.noLine")}</p>
      )}
    </div>
  );
}

function LineRow({
  line,
  onSave,
  busy,
}: {
  line: Line;
  onSave: (patch: { quantity: number | null; unitPrice: number | null; coverage: Coverage }) => void;
  busy: boolean;
}) {
  const t = useT();
  const [qty, setQty] = useState(line.quantity?.toString() ?? "");
  const [price, setPrice] = useState(line.unitPrice?.toString() ?? "");
  const [coverage, setCoverage] = useState<Coverage>(line.coverage);
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  return (
    <form
      className="grid gap-2 rounded-md border border-border p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ quantity: num(qty), unitPrice: num(price), coverage });
      }}
    >
      <p className="text-xs leading-snug">
        {line.position ? <span className="tabular-nums text-muted-foreground">{line.position} </span> : null}
        {line.description}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label className="text-[11px]" htmlFor={`lq-${line.id}`}>{t("bids.quantity")}{line.unit ? ` (${line.unit})` : ""}</Label>
          <Input id={`lq-${line.id}`} className="h-8" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px]" htmlFor={`lp-${line.id}`}>{t("bids.unitPrice")}</Label>
          <Input id={`lp-${line.id}`} className="h-8" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t("bids.coverageLabel")}>
        {(["included", "excluded", "optional", "unclear"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={coverage === c}
            onClick={() => setCoverage(c)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              coverage === c ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {t(`bids.coverage.${c}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {line.editedBy === "user" ? t("bids.editedByYou") : t("bids.readByAgent")}
        </span>
        <Button size="sm" type="submit" className="h-7" disabled={busy}>
          {t("bids.save")}
        </Button>
      </div>
    </form>
  );
}

function ContractorPanels({ cmp, projectId }: { cmp: Comparison; projectId: string }) {
  const t = useT();
  const ready = cmp.bids.filter((b) => b.status !== "received");
  if (!ready.length) return null;
  return (
    <section aria-label={t("bids.followUp")} className="rounded-xl border border-border bg-card p-4">
      <Tabs defaultValue={ready[0]!.id}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {ready.map((b) => {
            const n = cmp.flags.filter((f) => f.bidId === b.id && f.status === "open").length;
            return (
              <TabsTrigger key={b.id} value={b.id} className="gap-1.5">
                <span className="max-w-48 truncate">{b.contractorName}</span>
                {n ? <span className="rounded-full bg-amber-500/20 px-1.5 text-[11px] tabular-nums">{n}</span> : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {ready.map((b) => (
          <TabsContent key={b.id} value={b.id} className="mt-4">
            <ContractorPanel
              bid={b}
              flags={cmp.flags.filter((f) => f.bidId === b.id)}
              questions={cmp.questions.filter((q) => q.bidId === b.id)}
              projectId={projectId}
              projectName={cmp.project.name}
            />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function ContractorPanel({
  bid,
  flags,
  questions,
  projectId,
  projectName,
}: {
  bid: Bid;
  flags: Flag[];
  questions: Question[];
  projectId: string;
  projectName: string;
}) {
  const t = useT();
  const setFlag = useActionMutation("set-flag-status", {
    onError: (e) => toast.error(actionErrorMessage(e) ?? t("bids.genericError")),
  });
  const open = flags.filter((f) => f.status === "open");
  const settled = flags.filter((f) => f.status !== "open");
  const approved = questions.filter((q) => q.status === "approved");
  const sev = { high: 0, medium: 1, low: 2 } as const;

  const letter = [
    t("bids.letterGreeting"),
    "",
    t("bids.letterIntro", { project: projectName, ref: bid.quoteRef ?? "" }).trim(),
    "",
    ...approved.map((q, i) => `${i + 1}. ${q.text}`),
    "",
    t("bids.letterClose"),
  ].join("\n");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-2">
        <h3 className="text-sm font-semibold">{t("bids.issues")}</h3>
        {open.length ? (
          [...open]
            .sort((a, b) => sev[a.severity] - sev[b.severity])
            .map((f) => (
              <div key={f.id} className="flex gap-2 rounded-lg border border-border p-2.5">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    f.severity === "high" ? "bg-amber-500" : f.severity === "medium" ? "bg-amber-300" : "bg-muted-foreground/40",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{f.message}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {f.source === "agent" ? t("bids.byAgent") : t("bids.byCheck")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button size="icon" variant="ghost" className="size-7" title={t("bids.resolve")} aria-label={t("bids.resolve")} onClick={() => setFlag.mutate({ id: f.id, status: "resolved" })}>
                    <IconCheck className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" title={t("bids.dismiss")} aria-label={t("bids.dismiss")} onClick={() => setFlag.mutate({ id: f.id, status: "dismissed" })}>
                    <IconX className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
        ) : (
          <p className="text-sm text-muted-foreground">{t("bids.noIssues")}</p>
        )}
        {settled.length ? (
          <p className="text-xs text-muted-foreground">{t("bids.settledCount", { count: settled.length })}</p>
        ) : null}
      </div>

      <div className="grid content-start gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("bids.questions")}</h3>
          <Button
            size="sm"
            variant="outline"
            disabled={!open.length}
            onClick={() =>
              sendToAgentChat({
                message: t("bids.agentQuestions", { name: bid.contractorName }),
                context: JSON.stringify({ projectId, bidId: bid.id }),
                submit: true,
                openSidebar: true,
              })
            }
          >
            <IconSparkles className="size-3.5" />
            {t("bids.draftQuestions")}
          </Button>
        </div>
        {questions.length ? (
          questions.map((q) => <QuestionRow key={q.id} q={q} />)
        ) : (
          <p className="text-sm text-muted-foreground">{t("bids.noQuestions")}</p>
        )}
        {approved.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(letter).then(
                  () => toast.success(t("bids.copied")),
                  () => toast.error(t("bids.copyFailed")),
                );
              }}
            >
              <IconCopy className="size-3.5" />
              {t("bids.copyLetter", { count: approved.length })}
            </Button>
            {bid.contractorEmail ? (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={`mailto:${encodeURIComponent(bid.contractorEmail)}?subject=${encodeURIComponent(t("bids.letterSubject", { project: projectName }))}&body=${encodeURIComponent(letter)}`}
                >
                  <IconMail className="size-3.5" />
                  {t("bids.openEmail")}
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuestionRow({ q }: { q: Question }) {
  const t = useT();
  const [text, setText] = useState(q.text);
  const update = useActionMutation("update-question", {
    onError: (e) => toast.error(actionErrorMessage(e) ?? t("bids.genericError")),
  });
  const remove = useActionMutation("delete-question", {
    onError: (e) => toast.error(actionErrorMessage(e) ?? t("bids.genericError")),
  });
  const dirty = text.trim() !== q.text;
  return (
    <div className={cn("grid gap-2 rounded-lg border p-2.5", q.status === "approved" ? "border-emerald-600/40" : "border-border")}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="min-h-0 resize-y text-sm [field-sizing:content]" aria-label={t("bids.questionText")} />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[11px]", q.status === "approved" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
          {q.status === "approved" ? t("bids.approved") : t("bids.draft")}
        </span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="size-7" title={t("bids.delete")} aria-label={t("bids.delete")} onClick={() => remove.mutate({ id: q.id })}>
            <IconTrash className="size-3.5" />
          </Button>
          {dirty ? (
            <Button size="sm" variant="outline" className="h-7" onClick={() => update.mutate({ id: q.id, text })}>
              {t("bids.save")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={q.status === "approved" ? "ghost" : "default"}
            className="h-7"
            onClick={() => update.mutate({ id: q.id, text: dirty ? text : undefined, status: q.status === "approved" ? "draft" : "approved" })}
          >
            {q.status === "approved" ? t("bids.unapprove") : t("bids.approve")}
          </Button>
        </div>
      </div>
    </div>
  );
}
