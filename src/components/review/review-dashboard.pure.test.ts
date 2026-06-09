import { describe, expect, it } from "vitest";
import type { ReviewWorkspaceSummary } from "@/lib/db/review-workspace";
import {
  filterReviewWorkspaceSummaries,
  formatAbsoluteReviewDate,
  formatRelativeReviewTime,
  listReviewWorkspaceRepos,
  reviewWorkspaceRepoKey,
} from "./review-dashboard.pure";

function summary(overrides: Partial<ReviewWorkspaceSummary>): ReviewWorkspaceSummary {
  return {
    authorLogin: "octocat",
    baseRef: "main",
    fileCount: 3,
    headRef: "feature",
    id: "snap-1",
    number: 1,
    owner: "ef-global",
    prState: "open",
    repo: "backpack",
    status: "ready",
    title: "A change",
    updatedAt: new Date("2026-06-09T12:00:00Z"),
    url: "https://github.com/ef-global/backpack/pull/1",
    ...overrides,
  };
}

describe("reviewWorkspaceRepoKey / listReviewWorkspaceRepos", () => {
  it("derives owner/repo and returns sorted distinct repos", () => {
    const items = [
      summary({ id: "a", owner: "ef-global", repo: "backpack" }),
      summary({ id: "b", owner: "ef-global", repo: "backpack" }),
      summary({ id: "c", owner: "acme", repo: "widgets" }),
    ];

    expect(reviewWorkspaceRepoKey(items[0])).toBe("ef-global/backpack");
    expect(listReviewWorkspaceRepos(items)).toEqual(["acme/widgets", "ef-global/backpack"]);
  });
});

describe("filterReviewWorkspaceSummaries", () => {
  const items = [
    summary({ id: "a", owner: "ef-global", repo: "backpack", status: "ready" }),
    summary({ id: "b", owner: "ef-global", repo: "backpack", status: "preparing" }),
    summary({ id: "c", owner: "acme", repo: "widgets", status: "ready" }),
  ];

  it("returns all with the default filters", () => {
    expect(filterReviewWorkspaceSummaries(items, { repo: "all", status: "all" })).toHaveLength(3);
  });

  it("filters by status", () => {
    const ready = filterReviewWorkspaceSummaries(items, { repo: "all", status: "ready" });
    expect(ready.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("filters by repo", () => {
    const acme = filterReviewWorkspaceSummaries(items, { repo: "acme/widgets", status: "all" });
    expect(acme.map((item) => item.id)).toEqual(["c"]);
  });

  it("combines repo and status filters", () => {
    const result = filterReviewWorkspaceSummaries(items, { repo: "ef-global/backpack", status: "preparing" });
    expect(result.map((item) => item.id)).toEqual(["b"]);
  });
});

describe("formatRelativeReviewTime", () => {
  const base = new Date("2026-06-09T12:00:00Z");

  it("reports recent updates as just now", () => {
    expect(formatRelativeReviewTime(base, new Date("2026-06-09T12:00:30Z"))).toBe("just now");
  });

  it("reports minutes, hours, and days", () => {
    expect(formatRelativeReviewTime(base, new Date("2026-06-09T12:30:00Z"))).toBe("30m ago");
    expect(formatRelativeReviewTime(base, new Date("2026-06-09T15:00:00Z"))).toBe("3h ago");
    expect(formatRelativeReviewTime(base, new Date("2026-06-12T12:00:00Z"))).toBe("3d ago");
  });

  it("falls back to an absolute date beyond a week", () => {
    expect(formatRelativeReviewTime(base, new Date("2026-06-20T12:00:00Z"))).toBe("Jun 9, 2026");
  });

  it("accepts ISO strings", () => {
    expect(formatRelativeReviewTime("2026-06-09T12:00:00Z", new Date("2026-06-09T12:05:00Z"))).toBe("5m ago");
  });
});

describe("formatAbsoluteReviewDate", () => {
  it("formats a UTC date deterministically", () => {
    expect(formatAbsoluteReviewDate(new Date("2026-06-09T23:30:00Z"))).toBe("Jun 9, 2026");
  });
});
