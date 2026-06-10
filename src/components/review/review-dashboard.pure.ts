import type { ReviewWorkspaceState, ReviewWorkspaceSummary } from "@/lib/db/review-workspace";

export type ReviewStatusFilter = "all" | ReviewWorkspaceState;
export type ReviewRepoFilter = "all" | string;

export const REVIEW_STATUS_FILTERS: ReviewStatusFilter[] = ["all", "ready", "preparing", "imported", "failed"];

export function reviewWorkspaceRepoKey(item: Pick<ReviewWorkspaceSummary, "owner" | "repo">): string {
  return `${item.owner}/${item.repo}`;
}

/** Distinct `owner/repo` keys present in the list, alphabetically sorted. */
export function listReviewWorkspaceRepos(items: ReviewWorkspaceSummary[]): string[] {
  const repos = new Set<string>();

  for (const item of items) {
    repos.add(reviewWorkspaceRepoKey(item));
  }

  return [...repos].sort((a, b) => a.localeCompare(b));
}

export function filterReviewWorkspaceSummaries(
  items: ReviewWorkspaceSummary[],
  filters: { query?: string; repo: ReviewRepoFilter; status: ReviewStatusFilter },
): ReviewWorkspaceSummary[] {
  const query = normalizeReviewSearchQuery(filters.query ?? "");

  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    if (filters.repo !== "all" && reviewWorkspaceRepoKey(item) !== filters.repo) {
      return false;
    }

    return matchesReviewSearchQuery(item, query);
  });
}

export function normalizeReviewSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Case-insensitive substring match across the fields a reviewer is likely to
 * remember: title, owner/repo, PR number (`186` or `#186`), branches, author.
 */
export function matchesReviewSearchQuery(
  item: Pick<
    ReviewWorkspaceSummary,
    "authorLogin" | "baseRef" | "headRef" | "number" | "owner" | "prStatus" | "repo" | "title"
  >,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    item.title,
    reviewWorkspaceRepoKey(item),
    `#${item.number}`,
    item.baseRef,
    item.headRef,
    item.prStatus.replaceAll("_", " "),
    item.authorLogin ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
}

const DAY_MS = 86_400_000;

export const REVIEW_RECENCY_GROUP_LABELS = ["Today", "Yesterday", "This week", "This month", "Older"] as const;
export type ReviewRecencyGroupLabel = (typeof REVIEW_RECENCY_GROUP_LABELS)[number];

export interface ReviewRecencyGroup {
  items: ReviewWorkspaceSummary[];
  label: ReviewRecencyGroupLabel;
}

/**
 * Buckets an `updatedAt` relative to the viewer's local midnight, so "Today"
 * matches the calendar day they see: Today, Yesterday, This week (past 7
 * days), This month (past 30 days), Older.
 */
export function reviewRecencyGroupLabel(value: Date | string, now: Date): ReviewRecencyGroupLabel {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const time = toDate(value).getTime();

  if (time >= startOfToday.getTime()) {
    return "Today";
  }
  if (time >= startOfToday.getTime() - DAY_MS) {
    return "Yesterday";
  }
  if (time >= startOfToday.getTime() - 7 * DAY_MS) {
    return "This week";
  }
  if (time >= startOfToday.getTime() - 30 * DAY_MS) {
    return "This month";
  }
  return "Older";
}

/**
 * Groups reviews by update recency. Empty buckets are omitted and the input
 * order is preserved within each bucket (the server already sorts newest
 * first).
 */
export function groupReviewWorkspacesByRecency(items: ReviewWorkspaceSummary[], now: Date): ReviewRecencyGroup[] {
  const buckets = new Map<ReviewRecencyGroupLabel, ReviewWorkspaceSummary[]>();

  for (const item of items) {
    const label = reviewRecencyGroupLabel(item.updatedAt, now);
    const bucket = buckets.get(label);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(label, [item]);
    }
  }

  return REVIEW_RECENCY_GROUP_LABELS.filter((label) => buckets.has(label)).map((label) => ({
    items: buckets.get(label)!,
    label,
  }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Deterministic absolute label (UTC) used for SSR so it never mismatches on
 * hydration, e.g. `Jun 9, 2026`.
 */
export function formatAbsoluteReviewDate(value: Date | string): string {
  const date = toDate(value);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** Relative "updated" label computed against an injected `now`. */
export function formatRelativeReviewTime(value: Date | string, now: Date): string {
  const elapsedMs = now.getTime() - toDate(value).getTime();
  const seconds = Math.floor(elapsedMs / 1000);

  if (seconds < 45) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return formatAbsoluteReviewDate(value);
}
