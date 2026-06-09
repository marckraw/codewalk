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
  item: Pick<ReviewWorkspaceSummary, "authorLogin" | "baseRef" | "headRef" | "number" | "owner" | "repo" | "title">,
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
    item.authorLogin ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
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
