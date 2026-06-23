import 'server-only'

import {
  getPullRequestSnapshotById,
  listOpenReviewThreadRowsForPullRequest,
  listPullRequestFilePatches,
  setReviewThreadStatus,
} from '@/entities/database'
import { shouldMarkThreadOutdated } from './review-thread-outdated.pure'

export type MarkOutdatedReviewThreadsResult = {
  outdatedThreadIds: string[]
}

/**
 * Runs after a PR snapshot import: every open thread anchored to an older
 * head whose file diff no longer matches gets status=outdated. Threads stay
 * readable (and answerable) — the stored excerpt carries the original lines.
 */
export async function markOutdatedReviewThreadsForSnapshot(input: {
  snapshotId: string
}): Promise<MarkOutdatedReviewThreadsResult> {
  const snapshot = await getPullRequestSnapshotById(input.snapshotId)

  if (!snapshot) {
    return { outdatedThreadIds: [] }
  }

  const threads = await listOpenReviewThreadRowsForPullRequest({
    owner: snapshot.owner,
    pullRequestNumber: snapshot.number,
    repo: snapshot.repo,
  })
  // Discussions are whole-PR conversations, not line-anchored notes — a new
  // push never makes them "outdated". Only inline threads are candidates.
  const candidates = threads.filter(
    (thread) =>
      thread.kind !== 'discussion' &&
      thread.anchorCommitSha !== snapshot.headSha,
  )

  if (candidates.length === 0) {
    return { outdatedThreadIds: [] }
  }

  const newPatches = await listPullRequestFilePatches(snapshot.id)
  const anchorSnapshotIds = [
    ...new Set(
      candidates
        .map((thread) => thread.anchorSnapshotId)
        .filter((id): id is string => id !== null),
    ),
  ]
  const anchorPatchesBySnapshot = new Map(
    await Promise.all(
      anchorSnapshotIds.map(
        async (id) => [id, await listPullRequestFilePatches(id)] as const,
      ),
    ),
  )

  const outdatedThreadIds: string[] = []

  for (const thread of candidates) {
    const anchorPatches = thread.anchorSnapshotId
      ? anchorPatchesBySnapshot.get(thread.anchorSnapshotId)
      : undefined
    const outdated = shouldMarkThreadOutdated({
      anchorCommitSha: thread.anchorCommitSha,
      anchorPatch: anchorPatches?.get(thread.filePath) ?? null,
      newHeadSha: snapshot.headSha,
      newPatch: newPatches.get(thread.filePath) ?? null,
    })

    if (outdated) {
      await setReviewThreadStatus(thread.id, 'outdated')
      outdatedThreadIds.push(thread.id)
    }
  }

  return { outdatedThreadIds }
}
