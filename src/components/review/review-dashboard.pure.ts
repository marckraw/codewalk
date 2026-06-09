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
  filters: { repo: ReviewRepoFilter; status: ReviewStatusFilter },
): ReviewWorkspaceSummary[] {
  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    if (filters.repo !== "all" && reviewWorkspaceRepoKey(item) !== filters.repo) {
      return false;
    }

    return true;
  });
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
