import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  codeReviewGuideGenerations,
  guideSections,
  guideSectionFiles,
  guides,
  pullRequestComments,
  pullRequestCommits,
  pullRequestFiles,
  pullRequestSnapshots,
  reviewNotes,
  reviewProgress,
  users,
} from "./schema";

describe("database schema", () => {
  it("uses stable table names for core persisted objects", () => {
    expect(getTableName(users)).toBe("users");
    expect(getTableName(pullRequestSnapshots)).toBe("pull_request_snapshots");
    expect(getTableName(pullRequestFiles)).toBe("pull_request_files");
    expect(getTableName(pullRequestCommits)).toBe("pull_request_commits");
    expect(getTableName(pullRequestComments)).toBe("pull_request_comments");
    expect(getTableName(guides)).toBe("guides");
    expect(getTableName(codeReviewGuideGenerations)).toBe("code_review_guide_generations");
    expect(getTableName(guideSections)).toBe("guide_sections");
    expect(getTableName(guideSectionFiles)).toBe("guide_section_files");
    expect(getTableName(reviewNotes)).toBe("review_notes");
    expect(getTableName(reviewProgress)).toBe("review_progress");
  });

  it("keeps imported PR snapshots keyed by GitHub identity and head SHA", () => {
    expect(pullRequestSnapshots.owner.name).toBe("owner");
    expect(pullRequestSnapshots.repo.name).toBe("repo");
    expect(pullRequestSnapshots.number.name).toBe("number");
    expect(pullRequestSnapshots.headSha.name).toBe("head_sha");
  });

  it("anchors review state to a user and PR snapshot", () => {
    expect(reviewNotes.userId.name).toBe("user_id");
    expect(reviewNotes.snapshotId.name).toBe("snapshot_id");
    expect(reviewProgress.userId.name).toBe("user_id");
    expect(reviewProgress.snapshotId.name).toBe("snapshot_id");
  });

  it("stores daemon-shaped guide metadata and section file references", () => {
    expect(guides.daemonGuideId.name).toBe("daemon_guide_id");
    expect(guides.cacheIdentity.name).toBe("cache_identity");
    expect(guides.pullRequest.name).toBe("pull_request");
    expect(guides.summary.name).toBe("summary");
    expect(guides.overview.name).toBe("overview");
    expect(guideSections.daemonSectionId.name).toBe("daemon_section_id");
    expect(guideSections.narrative.name).toBe("narrative");
    expect(guideSections.riskRationale.name).toBe("risk_rationale");
    expect(guideSectionFiles.guideSectionId.name).toBe("guide_section_id");
    expect(guideSectionFiles.hunkHints.name).toBe("hunk_hints");
  });

  it("tracks guide generation status separately from daemon guide data", () => {
    expect(codeReviewGuideGenerations.snapshotId.name).toBe("snapshot_id");
    expect(codeReviewGuideGenerations.requestedByUserId.name).toBe("requested_by_user_id");
    expect(codeReviewGuideGenerations.guideId.name).toBe("guide_id");
    expect(codeReviewGuideGenerations.status.name).toBe("status");
    expect(codeReviewGuideGenerations.error.name).toBe("error");
    expect(codeReviewGuideGenerations.githubCommentId.name).toBe("github_comment_id");
    expect(codeReviewGuideGenerations.githubCommentUrl.name).toBe("github_comment_url");
  });
});
