import 'server-only'

import { and, eq } from 'drizzle-orm'
import { getDb } from './client'
import {
  reviewAgentSessions,
  type CodeReviewGuideProvider,
  type ReviewAgentSessionRow,
  type ReviewAgentSessionStatus,
} from './schema'

export type ReviewAgentSessionPullRequestRef = {
  owner: string
  pullRequestNumber: number
  repo: string
}

export type StartReviewAgentSessionInput = ReviewAgentSessionPullRequestRef & {
  createdByUserId: string | null
  daemonSessionId: string
  effort: string | null
  model: string
  provider: CodeReviewGuideProvider
  snapshotId: string
}

export type UpdateReviewAgentSessionSnapshotInput = {
  continuationToken: string | null
  daemonSessionId?: string
  id: string
  lastSeq: number
  prUrl: string | null
  snapshotId?: string
  status: ReviewAgentSessionStatus
  workspace: {
    baseRef: string
    branchName: string
    repository: string
  } | null
}

export function buildReviewAgentSessionRow(
  input: StartReviewAgentSessionInput,
) {
  return {
    continuationToken: null,
    createdByUserId: input.createdByUserId,
    daemonSessionId: input.daemonSessionId,
    effort: input.effort,
    lastSeq: 0,
    model: input.model,
    owner: input.owner.toLowerCase(),
    prUrl: null,
    provider: input.provider,
    pullRequestNumber: input.pullRequestNumber,
    repo: input.repo.toLowerCase(),
    snapshotId: input.snapshotId,
    status: 'idle' as const,
    workspaceBaseRef: null,
    workspaceBranchName: null,
    workspaceRepository: null,
  }
}

export async function getReviewAgentSessionForPullRequest(
  input: ReviewAgentSessionPullRequestRef,
): Promise<ReviewAgentSessionRow | null> {
  const db = getDb()
  const [session] = await db
    .select()
    .from(reviewAgentSessions)
    .where(
      and(
        eq(reviewAgentSessions.owner, input.owner.toLowerCase()),
        eq(reviewAgentSessions.repo, input.repo.toLowerCase()),
        eq(reviewAgentSessions.pullRequestNumber, input.pullRequestNumber),
      ),
    )
    .limit(1)

  return session ?? null
}

export async function startReviewAgentSession(
  input: StartReviewAgentSessionInput,
): Promise<ReviewAgentSessionRow> {
  const db = getDb()
  const row = buildReviewAgentSessionRow(input)
  const [session] = await db
    .insert(reviewAgentSessions)
    .values(row)
    .onConflictDoUpdate({
      set: {
        continuationToken: row.continuationToken,
        daemonSessionId: row.daemonSessionId,
        effort: row.effort,
        lastSeq: row.lastSeq,
        model: row.model,
        prUrl: row.prUrl,
        provider: row.provider,
        snapshotId: row.snapshotId,
        status: row.status,
        updatedAt: new Date(),
        workspaceBaseRef: row.workspaceBaseRef,
        workspaceBranchName: row.workspaceBranchName,
        workspaceRepository: row.workspaceRepository,
      },
      target: [
        reviewAgentSessions.owner,
        reviewAgentSessions.repo,
        reviewAgentSessions.pullRequestNumber,
      ],
    })
    .returning()

  return session
}

export async function updateReviewAgentSessionFromSnapshot(
  input: UpdateReviewAgentSessionSnapshotInput,
): Promise<ReviewAgentSessionRow> {
  const db = getDb()
  const [session] = await db
    .update(reviewAgentSessions)
    .set({
      ...(input.daemonSessionId
        ? { daemonSessionId: input.daemonSessionId }
        : {}),
      ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
      continuationToken: input.continuationToken,
      lastSeq: input.lastSeq,
      prUrl: input.prUrl,
      status: input.status,
      updatedAt: new Date(),
      workspaceBaseRef: input.workspace?.baseRef ?? null,
      workspaceBranchName: input.workspace?.branchName ?? null,
      workspaceRepository: input.workspace?.repository ?? null,
    })
    .where(eq(reviewAgentSessions.id, input.id))
    .returning()

  if (!session) {
    throw new Error('Review agent session was not found.')
  }

  return session
}
