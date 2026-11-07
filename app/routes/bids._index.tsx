import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconArrowRight, IconBath, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function BidsIndexRoute() {
  const t = useT();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const { data, isPending } = useActionQuery("list-bid-projects", {});
  const create = useActionMutation("create-bid-project", {
    onSuccess: (res) => navigate(`/bids/${res.id}`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? t("bids.createFailed")),
  });
  const demo = useActionMutation("create-demo-project", {
    onSuccess: (res) => navigate(`/bids/${res.id}`),
    onError: (e) => toast.error(actionErrorMessage(e) ?? t("bids.createFailed")),
  });
  const projects = data?.projects ?? [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("bids.indexTitle")}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{t("bids.indexLead")}</p>
      </section>

      <form
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate({ name: name.trim() });
        }}
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="project-name">{t("bids.projectName")}</Label>
          <Input
            id="project-name"
            value={name}
            maxLength={120}
            placeholder={t("bids.projectNamePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          <IconPlus className="size-4" />
          {t("bids.createProject")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={demo.isPending}
          onClick={() => demo.mutate({})}
        >
          <IconBath className="size-4" />
          {t("bids.loadDemo")}
        </Button>
      </form>

      <section className="flex flex-col gap-2">
        {isPending ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
        ) : projects.length ? (
          projects.map((p) => (
            <Link
              key={p.id}
              to={`/bids/${p.id}`}
              className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                {p.location ? (
                  <span className="block truncate text-xs text-muted-foreground">{p.location}</span>
                ) : null}
              </span>
              <IconArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t("bids.emptyProjects")}
          </p>
        )}
      </section>
    </main>
  );
}
