import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  guideSections,
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
    expect(getTableName(guideSections)).toBe("guide_sections");
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
});
