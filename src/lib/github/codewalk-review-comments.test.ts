import { describe, expect, it, vi } from "vitest";
import { GitHubClientError } from "@/lib/github/server/errors";
import {
  CODEWALK_REVIEW_COMMENT_MARKER,
  buildCodewalkReviewCommentBody,
  buildCodewalkReviewUrl,
  getCodewalkAppBaseUrl,
  upsertCodewalkReviewComment,
} from "./codewalk-review-comments";

describe("Codewalk review comments", () => {
  it("builds stable PR comment bodies with a hidden marker", () => {
    const reviewUrl = "https://codewalk.example.com/review/snapshot-id";

    expect(buildCodewalkReviewCommentBody({ reviewUrl, state: "preparing" })).toContain(
      CODEWALK_REVIEW_COMMENT_MARKER,
    );
    expect(buildCodewalkReviewCommentBody({ reviewUrl, state: "preparing" })).toContain("is preparing");
    expect(buildCodewalkReviewCommentBody({ reviewUrl, state: "ready" })).toContain("is ready");
    expect(buildCodewalkReviewCommentBody({ error: "Daemon failed", reviewUrl, state: "failed" })).toContain(
      "Daemon failed",
    );
  });

  it("builds review deep links from the app base URL", () => {
    expect(buildCodewalkReviewUrl({ appBaseUrl: "https://codewalk.example.com/", snapshotId: "snapshot-id" })).toBe(
      "https://codewalk.example.com/review/snapshot-id",
    );
    expect(getCodewalkAppBaseUrl({ NEXT_PUBLIC_APP_URL: "https://codewalk.example.com/path?debug=1" })).toBe(
      "https://codewalk.example.com/path",
    );
  });

  it("updates a stored comment id when available", async () => {
    const github = {
      createIssueComment: vi.fn(),
      listIssueComments: vi.fn(),
      updateIssueComment: vi.fn().mockResolvedValue({ body: "Ready", htmlUrl: "url", id: 10 }),
    };

    await expect(
      upsertCodewalkReviewComment({
        body: "Ready",
        existingCommentId: "10",
        github,
        pullRequest: { number: 42, owner: "ef-global", repo: "example" },
      }),
    ).resolves.toEqual({ body: "Ready", htmlUrl: "url", id: 10 });

    expect(github.updateIssueComment).toHaveBeenCalledWith(
      { number: 42, owner: "ef-global", repo: "example" },
      "10",
      "Ready",
    );
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });

  it("recovers by marker when the stored comment id is missing", async () => {
    const github = {
      createIssueComment: vi.fn(),
      listIssueComments: vi.fn().mockResolvedValue([
        { body: `${CODEWALK_REVIEW_COMMENT_MARKER}\nOld`, htmlUrl: "old-url", id: 7 },
      ]),
      updateIssueComment: vi.fn().mockResolvedValue({ body: "Ready", htmlUrl: "url", id: 7 }),
    };

    await upsertCodewalkReviewComment({
      body: "Ready",
      existingCommentId: null,
      github,
      pullRequest: { number: 42, owner: "ef-global", repo: "example" },
    });

    expect(github.updateIssueComment).toHaveBeenCalledWith(
      { number: 42, owner: "ef-global", repo: "example" },
      "7",
      "Ready",
    );
  });

  it("creates a comment when no stored or marked comment exists", async () => {
    const github = {
      createIssueComment: vi.fn().mockResolvedValue({ body: "Preparing", htmlUrl: "url", id: 11 }),
      listIssueComments: vi.fn().mockResolvedValue([]),
      updateIssueComment: vi.fn(),
    };

    await upsertCodewalkReviewComment({
      body: "Preparing",
      existingCommentId: null,
      github,
      pullRequest: { number: 42, owner: "ef-global", repo: "example" },
    });

    expect(github.createIssueComment).toHaveBeenCalledWith(
      { number: 42, owner: "ef-global", repo: "example" },
      "Preparing",
    );
  });

  it("falls back to marker lookup when the stored id no longer exists", async () => {
    const github = {
      createIssueComment: vi.fn(),
      listIssueComments: vi.fn().mockResolvedValue([
        { body: `${CODEWALK_REVIEW_COMMENT_MARKER}\nOld`, htmlUrl: "old-url", id: 7 },
      ]),
      updateIssueComment: vi
        .fn()
        .mockRejectedValueOnce(new GitHubClientError("not_found", "Missing comment."))
        .mockResolvedValueOnce({ body: "Ready", htmlUrl: "url", id: 7 }),
    };

    await upsertCodewalkReviewComment({
      body: "Ready",
      existingCommentId: "10",
      github,
      pullRequest: { number: 42, owner: "ef-global", repo: "example" },
    });

    expect(github.updateIssueComment).toHaveBeenCalledTimes(2);
  });
});
