import "server-only";

import { eq } from "drizzle-orm";
import type { NormalizedPullRequestSnapshot } from "@/lib/github/domain";
import { getDb } from "./client";
import {
  pullRequestComments,
  pullRequestCommits,
  pullRequestFiles,
  pullRequestSnapshots,
} from "./schema";

export type PersistPullRequestSnapshotInput = {
  importedByUserId: string | null;
  snapshot: NormalizedPullRequestSnapshot;
};

export type PullRequestSnapshotRow = typeof pullRequestSnapshots.$inferSelect;

export function buildPullRequestSnapshotRows(input: PersistPullRequestSnapshotInput) {
  const { importedByUserId, snapshot } = input;
  const { pullRequest } = snapshot;

  return {
    comments: snapshot.comments.map((comment) => ({
      authorLogin: comment.authorLogin,
      body: comment.body,
      createdAt: new Date(comment.createdAt),
      githubId: comment.githubId,
      line: comment.line,
      path: comment.path,
      type: comment.type,
      updatedAt: comment.updatedAt ? new Date(comment.updatedAt) : null,
    })),
    commits: snapshot.commits.map((commit) => ({
      authorEmail: commit.authorEmail,
      authorName: commit.authorName,
      authoredAt: commit.authoredAt ? new Date(commit.authoredAt) : null,
      message: commit.message,
      sha: commit.sha,
    })),
    files: snapshot.files.map((file) => ({
      additions: file.additions,
      blobSha: file.blobSha,
      changes: file.changes,
      deletions: file.deletions,
      patch: file.patch,
      path: file.path,
      previousPath: file.previousPath,
      status: file.status,
    })),
    snapshot: {
      authorLogin: pullRequest.authorLogin,
      baseRef: pullRequest.baseRef,
      baseSha: pullRequest.baseSha,
      headRef: pullRequest.headRef,
      headSha: pullRequest.headSha,
      importedAt: new Date(),
      importedByUserId,
      number: pullRequest.number,
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      state: pullRequest.state,
      title: pullRequest.title,
      updatedAt: new Date(),
      url: pullRequest.url,
    },
  };
}

export async function persistPullRequestSnapshot(input: PersistPullRequestSnapshotInput) {
  const db = getDb();
  const rows = buildPullRequestSnapshotRows(input);

  return db.transaction(async (tx) => {
    const [snapshot] = await tx
      .insert(pullRequestSnapshots)
      .values(rows.snapshot)
      .onConflictDoUpdate({
        set: {
          authorLogin: rows.snapshot.authorLogin,
          baseRef: rows.snapshot.baseRef,
          baseSha: rows.snapshot.baseSha,
          headRef: rows.snapshot.headRef,
          headSha: rows.snapshot.headSha,
          importedAt: rows.snapshot.importedAt,
          importedByUserId: rows.snapshot.importedByUserId,
          state: rows.snapshot.state,
          title: rows.snapshot.title,
          updatedAt: rows.snapshot.updatedAt,
          url: rows.snapshot.url,
        },
        target: [
          pullRequestSnapshots.owner,
          pullRequestSnapshots.repo,
          pullRequestSnapshots.number,
          pullRequestSnapshots.headSha,
        ],
      })
      .returning();

    await tx.delete(pullRequestFiles).where(eq(pullRequestFiles.snapshotId, snapshot.id));
    await tx.delete(pullRequestCommits).where(eq(pullRequestCommits.snapshotId, snapshot.id));
    await tx.delete(pullRequestComments).where(eq(pullRequestComments.snapshotId, snapshot.id));

    if (rows.files.length > 0) {
      await tx
        .insert(pullRequestFiles)
        .values(rows.files.map((file) => ({ ...file, snapshotId: snapshot.id })));
    }

    if (rows.commits.length > 0) {
      await tx
        .insert(pullRequestCommits)
        .values(rows.commits.map((commit) => ({ ...commit, snapshotId: snapshot.id })));
    }

    if (rows.comments.length > 0) {
      await tx
        .insert(pullRequestComments)
        .values(rows.comments.map((comment) => ({ ...comment, snapshotId: snapshot.id })));
    }

    return snapshot;
  });
}

export async function getPullRequestSnapshotById(snapshotId: string): Promise<PullRequestSnapshotRow | null> {
  const db = getDb();
  const [snapshot] = await db.select().from(pullRequestSnapshots).where(eq(pullRequestSnapshots.id, snapshotId)).limit(1);

  return snapshot ?? null;
}
