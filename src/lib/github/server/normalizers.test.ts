import { describe, expect, it } from "vitest";
import {
  normalizeIssueCommentResponse,
  normalizePullRequestCommitResponse,
  normalizePullRequestFileResponse,
  normalizePullRequestResponse,
  normalizeReviewCommentResponse,
} from "./normalizers";

describe("GitHub REST normalizers", () => {
  it("normalizes pull request metadata into the snapshot shape", () => {
    expect(
      normalizePullRequestResponse(
        { number: 24, owner: "openai", repo: "codex" },
        {
          base: { ref: "main", sha: "base-sha" },
          body: "Adds an importer",
          created_at: "2026-01-01T10:00:00Z",
          draft: false,
          head: { ref: "feature", sha: "head-sha" },
          html_url: "https://github.com/openai/codex/pull/24",
          merged_at: null,
          number: 24,
          state: "open",
          title: "Import pull request snapshots",
          updated_at: "2026-01-02T10:00:00Z",
          user: { login: "octocat" },
        },
      ),
    ).toEqual({
      authorLogin: "octocat",
      baseRef: "main",
      baseSha: "base-sha",
      body: "Adds an importer",
      createdAt: "2026-01-01T10:00:00Z",
      draft: false,
      headRef: "feature",
      headSha: "head-sha",
      mergedAt: null,
      number: 24,
      owner: "openai",
      repo: "codex",
      state: "open",
      title: "Import pull request snapshots",
      updatedAt: "2026-01-02T10:00:00Z",
      url: "https://github.com/openai/codex/pull/24",
    });
  });

  it("normalizes changed files with patches and renamed paths", () => {
    expect(
      normalizePullRequestFileResponse({
        additions: 12,
        changes: 15,
        deletions: 3,
        filename: "src/new-name.ts",
        patch: "@@ -1 +1 @@",
        previous_filename: "src/old-name.ts",
        sha: "blob-sha",
        status: "renamed",
      }),
    ).toEqual({
      additions: 12,
      blobSha: "blob-sha",
      changes: 15,
      deletions: 3,
      patch: "@@ -1 +1 @@",
      path: "src/new-name.ts",
      previousPath: "src/old-name.ts",
      status: "renamed",
    });
  });

  it("normalizes commits and both pull request comment kinds", () => {
    expect(
      normalizePullRequestCommitResponse({
        author: { login: "octocat" },
        commit: {
          author: {
            date: "2026-01-03T10:00:00Z",
            email: "octocat@example.com",
            name: "Octocat",
          },
          message: "Implement importer",
        },
        sha: "commit-sha",
      }),
    ).toEqual({
      authorEmail: "octocat@example.com",
      authorLogin: "octocat",
      authorName: "Octocat",
      authoredAt: "2026-01-03T10:00:00Z",
      message: "Implement importer",
      sha: "commit-sha",
    });

    expect(
      normalizeIssueCommentResponse({
        body: "Looks good overall",
        created_at: "2026-01-04T10:00:00Z",
        html_url: "https://github.com/openai/codex/pull/24#issuecomment-1",
        id: 1,
        updated_at: "2026-01-04T11:00:00Z",
        user: { login: "reviewer" },
      }),
    ).toMatchObject({
      githubId: "issue:1",
      line: null,
      path: null,
      type: "issue_comment",
    });

    expect(
      normalizeReviewCommentResponse({
        body: "Check this line",
        created_at: "2026-01-04T10:00:00Z",
        html_url: "https://github.com/openai/codex/pull/24#discussion_r2",
        id: 2,
        line: 19,
        path: "src/importer.ts",
        updated_at: "2026-01-04T11:00:00Z",
        user: { login: "reviewer" },
      }),
    ).toMatchObject({
      githubId: "review:2",
      line: 19,
      path: "src/importer.ts",
      type: "review_comment",
    });
  });
});
