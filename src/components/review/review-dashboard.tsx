"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, GitPullRequestArrow, Search } from "lucide-react";
import { CodeReviewGuideGenerationControl } from "@/components/code-review-guide-generation-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import type { ReviewWorkspaceState, ReviewWorkspaceSummary } from "@/lib/db/review-workspace";
import { REVIEW_WORKSPACE_POLL_INTERVAL_MS } from "./use-review-workspace-live.pure";
import {
  filterReviewWorkspaceSummaries,
  formatAbsoluteReviewDate,
  formatRelativeReviewTime,
  groupReviewWorkspacesByRecency,
  listReviewWorkspaceRepos,
  REVIEW_STATUS_FILTERS,
  type ReviewRepoFilter,
  type ReviewStatusFilter,
} from "./review-dashboard.pure";

const STATUS_TONE: Record<ReviewWorkspaceState, "success" | "warning" | "danger" | "muted"> = {
  failed: "danger",
  imported: "muted",
  preparing: "warning",
  ready: "success",
};

const STATUS_LABEL: Record<ReviewStatusFilter, string> = {
  all: "All",
  failed: "Failed",
  imported: "Imported",
  preparing: "Preparing",
  ready: "Ready",
};

interface ReviewDashboardProps {
  items: ReviewWorkspaceSummary[];
}

// Current minute as a cached external store: stable between ticks (so
// useSyncExternalStore is happy) and null on the server so relative times never
// cause a hydration mismatch.
let cachedNowMs = 0;

function subscribeNow(callback: () => void) {
  cachedNowMs = Date.now();
  callback();
  const interval = setInterval(() => {
    cachedNowMs = Date.now();
    callback();
  }, 60_000);
  return () => clearInterval(interval);
}

export function ReviewDashboard({ items }: ReviewDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("all");
  const [repoFilter, setRepoFilter] = useState<ReviewRepoFilter>("all");
  const [query, setQuery] = useState("");
  const nowMs = useSyncExternalStore(
    subscribeNow,
    () => cachedNowMs,
    () => null,
  );
  const now = nowMs ? new Date(nowMs) : null;

  // While any guide is being prepared, re-render from the server on the same
  // cadence as the workspace poller so rows flip to ready/failed on their own.
  const router = useRouter();
  const hasPreparing = items.some((item) => item.status === "preparing");
  useEffect(() => {
    if (!hasPreparing) {
      return;
    }

    const timer = setInterval(() => router.refresh(), REVIEW_WORKSPACE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPreparing, router]);

  const repos = useMemo(() => listReviewWorkspaceRepos(items), [items]);
  const statusCounts = useMemo(() => countByStatus(items), [items]);
  const visibleItems = useMemo(
    () => filterReviewWorkspaceSummaries(items, { query, repo: repoFilter, status: statusFilter }),
    [items, query, repoFilter, statusFilter],
  );
  // Recency buckets need a local clock, so on the server (now is null) the
  // list renders flat and groups appear right after hydration — same tradeoff
  // as the relative timestamps.
  const recencyGroups = useMemo(
    () => (nowMs ? groupReviewWorkspacesByRecency(visibleItems, new Date(nowMs)) : null),
    [visibleItems, nowMs],
  );

  return (
    <div className="grid gap-3 p-3">
      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
        <TextField
          aria-label="Search reviews"
          className="h-9 w-full pl-9"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, repo, #number, branch, or author"
          type="search"
          value={query}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {REVIEW_STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter;
            const filterCount = filter === "all" ? items.length : statusCounts[filter] ?? 0;

            return (
              <Button
                key={filter}
                className={cn("h-7 px-2 text-xs", filterCount === 0 && !active && "opacity-60")}
                onClick={() => setStatusFilter(filter)}
                size="sm"
                type="button"
                variant={active ? "secondary" : "ghost"}
              >
                {STATUS_LABEL[filter]} {filterCount}
              </Button>
            );
          })}
        </div>

        {repos.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Repository
            <select
              className="h-7 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 text-xs text-[var(--foreground)]"
              onChange={(event) => setRepoFilter(event.target.value)}
              value={repoFilter}
            >
              <option value="all">All repositories</option>
              {repos.map((repo) => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {visibleItems.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          No reviews match the current filters.
        </p>
      ) : recencyGroups ? (
        <div className="grid gap-4">
          {recencyGroups.map((group) => (
            <section key={group.label} className="grid gap-2">
              <h2 className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                {group.label}
                <span className="font-normal normal-case tracking-normal">{group.items.length}</span>
              </h2>
              <ul className="grid gap-2">
                {group.items.map((item) => (
                  <ReviewWorkspaceRow item={item} key={item.id} now={now} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="grid gap-2">
          {visibleItems.map((item) => (
            <ReviewWorkspaceRow item={item} key={item.id} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewWorkspaceRow({ item, now }: { item: ReviewWorkspaceSummary; now: Date | null }) {
  return (
    <li className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <Link
        className="group flex min-w-0 flex-1 flex-col gap-1 outline-none"
        href={`/review/${encodeURIComponent(item.id)}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
          <span className="truncate font-mono text-xs text-[var(--muted)]">
            {item.owner}/{item.repo} #{item.number}
          </span>
        </div>
        <p className="truncate text-sm font-semibold group-hover:underline">{item.title}</p>
        <p className="truncate text-xs text-[var(--muted)]">
          {item.fileCount} {item.fileCount === 1 ? "file" : "files"} · {item.baseRef} → {item.headRef} · updated{" "}
          {now ? formatRelativeReviewTime(item.updatedAt, now) : formatAbsoluteReviewDate(item.updatedAt)}
        </p>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <Button asChild className="h-8 gap-1.5 px-2 text-xs" size="sm" variant="outline">
          <a href={item.url} rel="noreferrer" target="_blank">
            <GitPullRequestArrow className="size-3.5" />
            PR
          </a>
        </Button>
        <CodeReviewGuideGenerationControl force label="Regenerate" snapshotId={item.id} />
        <Button asChild className="h-8 gap-1.5 px-2 text-xs" size="sm" variant="primary">
          <Link href={`/review/${encodeURIComponent(item.id)}`}>
            Open
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </li>
  );
}

function countByStatus(items: ReviewWorkspaceSummary[]): Record<ReviewWorkspaceState, number> {
  const counts: Record<ReviewWorkspaceState, number> = { failed: 0, imported: 0, preparing: 0, ready: 0 };

  for (const item of items) {
    counts[item.status] += 1;
  }

  return counts;
}
