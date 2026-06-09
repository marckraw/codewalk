import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReviewSnapshotPage from "./page";

vi.mock("@/components/auth/auth-controls", () => ({
  AuthControls: () => <div data-testid="auth-controls" />,
}));

vi.mock("@/components/code-review-guide-generation-control", () => ({
  CodeReviewGuideGenerationControl: () => <button type="button">Regenerate</button>,
}));

vi.mock("@/components/theme-mode-toggle", () => ({
  ThemeModeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentCodewalkUser: vi.fn(),
}));

vi.mock("@/lib/db/review-workspace", () => ({
  getReviewWorkspace: vi.fn(),
}));

import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { getReviewWorkspace } from "@/lib/db/review-workspace";

describe("ReviewSnapshotPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: "reviewer@example.com",
      name: "Reviewer",
      status: "authenticated",
      userId: "clerk-user-id",
    });
    vi.mocked(getReviewWorkspace).mockResolvedValue(fixtureWorkspace as never);
  });

  it("renders a persisted snapshot and ready daemon guide", async () => {
    render(await ReviewSnapshotPage({ params: Promise.resolve({ snapshotId: "snapshot-id" }) }));

    expect(screen.getByText("Add guided review")).toBeInTheDocument();
    expect(screen.getByText(/ef-global\/example/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Guide/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Guide persistence").length).toBeGreaterThan(0);
    expect(screen.getByText("The persistence model follows agents-daemon.")).toBeInTheDocument();
    expect(screen.getAllByText("src/lib/db/schema.ts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Guide schema changed.").length).toBeGreaterThan(0);
  });

  it("renders auth-required state when called without an authenticated user", async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({ status: "signed-out" });

    render(await ReviewSnapshotPage({ params: Promise.resolve({ snapshotId: "snapshot-id" }) }));

    expect(screen.getByText("Protected review")).toBeInTheDocument();
    expect(getReviewWorkspace).not.toHaveBeenCalled();
  });

  it("loads review data for any authenticated Codewalk user", async () => {
    render(await ReviewSnapshotPage({ params: Promise.resolve({ snapshotId: "snapshot-id" }) }));

    expect(getReviewWorkspace).toHaveBeenCalledWith("snapshot-id");
  });
});

const now = new Date("2026-06-09T08:00:00.000Z");

const fixtureWorkspace = {
  files: [
    {
      additions: 12,
      blobSha: "blob-sha",
      changes: 14,
      createdAt: now,
      deletions: 2,
      id: "file-id",
      patch: "+export const guides = pgTable(",
      path: "src/lib/db/schema.ts",
      previousPath: null,
      snapshotId: "snapshot-id",
      status: "modified",
    },
  ],
  generation: {
    createdAt: now,
    effort: "high",
    error: null,
    finishedAt: now,
    force: false,
    guideId: "guide-id",
    id: "generation-id",
    model: "gpt-5.4",
    provider: "codex",
    requestedByUserId: "user-id",
    snapshotId: "snapshot-id",
    startedAt: now,
    status: "ready",
    updatedAt: now,
  },
  guide: {
    cacheIdentity: {
      comparisonPoint: "base-sha",
      comparisonRef: "main",
      workingTreeVersionToken: "head-sha",
    },
    cacheKey: "cache-key",
    createdAt: now,
    daemonGuideId: "daemon-guide-id",
    effort: "high",
    error: null,
    generatedBy: "agent",
    id: "guide-id",
    mode: "pull-request",
    model: "gpt-5.4",
    overview: "Review persistence and API boundaries.",
    provider: "codex",
    pullRequest: {
      baseBranch: "main",
      headBranch: "feature",
      headRepositoryName: "example",
      headRepositoryOwner: "ef-global",
      number: 42,
      provider: "github",
      repositoryName: "example",
      repositoryOwner: "ef-global",
      state: "open",
      title: "Add guided review",
      url: "https://github.com/ef-global/example/pull/42",
    },
    pullRequestNumber: 42,
    repository: "https://github.com/ef-global/example",
    sections: [
      {
        checklist: ["Check migration"],
        createdAt: now,
        daemonSectionId: "section-1",
        files: [
          {
            createdAt: now,
            guideSectionId: "section-row-id",
            hunkHints: ["@@ -1 +1 @@"],
            id: "section-file-id",
            order: 0,
            path: "src/lib/db/schema.ts",
            reason: "Guide schema changed.",
            status: "modified",
          },
        ],
        guideId: "guide-id",
        id: "section-row-id",
        narrative: "The persistence model follows agents-daemon.",
        order: 0,
        riskLevel: "medium",
        riskRationale: "Persistence contract changed.",
        summary: "Guide schema changed.",
        title: "Guide persistence",
      },
    ],
    snapshotId: "snapshot-id",
    status: "ready",
    summary: {
      cacheIdentity: {
        comparisonPoint: "base-sha",
        comparisonRef: "main",
        workingTreeVersionToken: "head-sha",
      },
      files: [],
    },
    targetId: "pull-request:https://github.com/ef-global/example#42",
    updatedAt: now,
  },
  snapshot: {
    authorLogin: "octocat",
    baseRef: "main",
    baseSha: "base-sha",
    createdAt: now,
    headRef: "feature",
    headSha: "head-sha",
    id: "snapshot-id",
    importedAt: now,
    importedByUserId: "user-id",
    number: 42,
    owner: "ef-global",
    repo: "example",
    state: "open",
    title: "Add guided review",
    updatedAt: now,
    url: "https://github.com/ef-global/example/pull/42",
  },
  state: "ready",
};
