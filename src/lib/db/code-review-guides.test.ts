import { describe, expect, it, vi } from "vitest";
import {
  buildCodeReviewGuideCacheKey,
  buildCodeReviewGuideRows,
  type CodeReviewGuide,
} from "./code-review-guides";

vi.mock("server-only", () => ({}));

describe("buildCodeReviewGuideCacheKey", () => {
  it("matches the daemon cache identity key shape", () => {
    expect(
      buildCodeReviewGuideCacheKey({
        comparisonPoint: "base-sha",
        comparisonRef: "main",
        workingTreeVersionToken: "head-sha",
      }),
    ).toBe(
      JSON.stringify({
        comparisonRef: "main",
        comparisonPoint: "base-sha",
        workingTreeVersionToken: "head-sha",
      }),
    );
  });
});

describe("buildCodeReviewGuideRows", () => {
  it("maps a daemon guide into guide, section, and section file rows", () => {
    const rows = buildCodeReviewGuideRows({
      guide: fixtureGuide,
      snapshotId: "snapshot-id",
    });

    expect(rows.guide).toMatchObject({
      cacheKey: JSON.stringify({
        comparisonRef: "main",
        comparisonPoint: "base-sha",
        workingTreeVersionToken: "head-sha",
      }),
      daemonGuideId: "guide-1",
      generatedBy: "agent",
      mode: "pull-request",
      overview: "Review the API contract and persistence changes.",
      provider: "codex",
      pullRequestNumber: 24,
      repository: "https://github.com/openai/codex",
      snapshotId: "snapshot-id",
      status: "ready",
      targetId: "pull-request:https://github.com/openai/codex#24",
    });
    expect(rows.guide.createdAt).toBeInstanceOf(Date);
    expect(rows.guide.updatedAt).toBeInstanceOf(Date);
    expect(rows.guide.cacheIdentity).toEqual(fixtureGuide.cacheIdentity);
    expect(rows.guide.pullRequest).toEqual(fixtureGuide.pullRequest);
    expect(rows.guide.summary).toEqual(fixtureGuide.summary);

    expect(rows.sections).toEqual([
      {
        files: [
          {
            hunkHints: ["@@ -1 +1 @@"],
            order: 0,
            path: "src/api.ts",
            reason: "The route contract changed.",
            status: "modified",
          },
        ],
        section: {
          checklist: ["Verify request validation.", "Check response shape."],
          daemonSectionId: "section-1",
          narrative: "The endpoint now persists a canonical guide.",
          order: 0,
          riskLevel: "medium",
          riskRationale: "It changes persisted review data.",
          summary: "API and persistence contract changed.",
          title: "Persistence contract",
        },
      },
    ]);
  });
});

const fixtureGuide: CodeReviewGuide = {
  cacheIdentity: {
    comparisonPoint: "base-sha",
    comparisonRef: "main",
    workingTreeVersionToken: "head-sha",
  },
  createdAt: "2026-06-01T10:00:00.000Z",
  effort: null,
  error: null,
  generatedBy: "agent",
  id: "guide-1",
  mode: "pull-request",
  model: "gpt-5.4",
  overview: "Review the API contract and persistence changes.",
  provider: "codex",
  pullRequest: {
    baseBranch: "main",
    headBranch: "feature",
    headRepositoryName: "codex",
    headRepositoryOwner: "openai",
    number: 24,
    provider: "github",
    repositoryName: "codex",
    repositoryOwner: "openai",
    state: "open",
    title: "Import pull request snapshots",
    url: "https://github.com/openai/codex/pull/24",
  },
  pullRequestNumber: 24,
  repository: "https://github.com/openai/codex",
  sections: [
    {
      checklist: ["Verify request validation.", "Check response shape."],
      files: [
        {
          hunkHints: ["@@ -1 +1 @@"],
          path: "src/api.ts",
          reason: "The route contract changed.",
          status: "modified",
        },
      ],
      id: "section-1",
      narrative: "The endpoint now persists a canonical guide.",
      riskLevel: "medium",
      riskRationale: "It changes persisted review data.",
      summary: "API and persistence contract changed.",
      title: "Persistence contract",
    },
  ],
  status: "ready",
  summary: {
    cacheIdentity: {
      comparisonPoint: "base-sha",
      comparisonRef: "main",
      workingTreeVersionToken: "head-sha",
    },
    files: [
      {
        file: "src/api.ts",
        status: "modified",
      },
    ],
  },
  targetId: "pull-request:https://github.com/openai/codex#24",
  updatedAt: "2026-06-01T10:01:00.000Z",
};
