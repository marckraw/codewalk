import 'server-only'

import { asc, and, desc, eq } from 'drizzle-orm'
import type {
  ReviewThreadAgentState,
  ReviewThreadCommentAuthorType,
  ReviewThreadCommentRow,
  ReviewThreadDiffSide,
  ReviewThreadRow,
} from './schema'
import { getDb } from './client'
import { reviewThreadComments, reviewThreads } from './schema'

export type ReviewThreadInsert = {
  owner: string
  repo: string
  pullRequestNumber: number
  anchorSnapshotId: string | null
  anchorCommitSha: string
  filePath: string
  side: ReviewThreadDiffSide
  lineStart: number
  lineEnd: number
  excerpt: string
  createdByUserId: string
}

export type ReviewThreadCommentInsert = {
  threadId: string
  authorType: ReviewThreadCommentAuthorType
  authorUserId: string | null
  body: string
  agentState?: ReviewThreadAgentState | null
  agentSeqStart?: number | null
}

export type ReviewThreadCommentUpdate = {
  agentSeqStart?: number | null
  agentState?: ReviewThreadAgentState | null
  body?: string
  commentId: string
}

export type ReviewThreadWithComments = ReviewThreadRow & {
  comments: ReviewThreadCommentRow[]
}

/**
 * Owners and repos are stored lowercase like the rest of the schema so PR
 * identity lookups are case-insensitive. Line ranges are normalized so
 * lineStart <= lineEnd regardless of selection direction.
 */
export function buildReviewThreadRow(input: ReviewThreadInsert) {
  return {
    owner: input.owner.toLowerCase(),
    repo: input.repo.toLowerCase(),
    pullRequestNumber: input.pullRequestNumber,
    anchorSnapshotId: input.anchorSnapshotId,
    anchorCommitSha: input.anchorCommitSha,
    filePath: input.filePath,
    side: input.side,
    lineStart: Math.min(input.lineStart, input.lineEnd),
    lineEnd: Math.max(input.lineStart, input.lineEnd),
    excerpt: input.excerpt,
    createdByUserId: input.createdByUserId,
  }
}

export function buildReviewThreadCommentRow(input: ReviewThreadCommentInsert) {
  return {
    threadId: input.threadId,
    authorType: input.authorType,
    authorUserId: input.authorUserId,
    body: input.body,
    agentState: input.agentState ?? null,
    agentSeqStart: input.agentSeqStart ?? null,
  }
}

export async function createReviewThread(
  input: ReviewThreadInsert & { body: string },
): Promise<ReviewThreadWithComments> {
  const db = getDb()
  const [thread] = await db
    .insert(reviewThreads)
    .values(buildReviewThreadRow(input))
    .returning()
  const [comment] = await db
    .insert(reviewThreadComments)
    .values(
      buildReviewThreadCommentRow({
        threadId: thread.id,
        authorType: 'user',
        authorUserId: input.createdByUserId,
        body: input.body,
      }),
    )
    .returning()
  return { ...thread, comments: [comment] }
}

export async function listReviewThreadsForPullRequest(input: {
  owner: string
  repo: string
  pullRequestNumber: number
}): Promise<ReviewThreadWithComments[]> {
  const db = getDb()
  const threads = await db
    .select()
    .from(reviewThreads)
    .where(
      and(
        eq(reviewThreads.owner, input.owner.toLowerCase()),
        eq(reviewThreads.repo, input.repo.toLowerCase()),
        eq(reviewThreads.pullRequestNumber, input.pullRequestNumber),
      ),
    )
    .orderBy(desc(reviewThreads.createdAt))

  if (threads.length === 0) return []

  const withComments: ReviewThreadWithComments[] = []
  for (const thread of threads) {
    const comments = await db
      .select()
      .from(reviewThreadComments)
      .where(eq(reviewThreadComments.threadId, thread.id))
      .orderBy(asc(reviewThreadComments.createdAt))
    withComments.push({ ...thread, comments })
  }
  return withComments
}

export async function getReviewThread(
  threadId: string,
): Promise<ReviewThreadWithComments | null> {
  const db = getDb()
  const [thread] = await db
    .select()
    .from(reviewThreads)
    .where(eq(reviewThreads.id, threadId))
    .limit(1)
  if (!thread) return null
  const comments = await db
    .select()
    .from(reviewThreadComments)
    .where(eq(reviewThreadComments.threadId, threadId))
    .orderBy(asc(reviewThreadComments.createdAt))
  return { ...thread, comments }
}

export async function addReviewThreadComment(
  input: ReviewThreadCommentInsert,
): Promise<ReviewThreadCommentRow> {
  const db = getDb()
  const [comment] = await db
    .insert(reviewThreadComments)
    .values(buildReviewThreadCommentRow(input))
    .returning()
  await db
    .update(reviewThreads)
    .set({ updatedAt: new Date() })
    .where(eq(reviewThreads.id, input.threadId))
  return comment
}

export async function updateReviewThreadComment(
  input: ReviewThreadCommentUpdate,
): Promise<ReviewThreadCommentRow> {
  const db = getDb()
  const [comment] = await db
    .update(reviewThreadComments)
    .set({
      ...(input.body === undefined ? {} : { body: input.body }),
      ...(input.agentState === undefined
        ? {}
        : { agentState: input.agentState }),
      ...(input.agentSeqStart === undefined
        ? {}
        : { agentSeqStart: input.agentSeqStart }),
    })
    .where(eq(reviewThreadComments.id, input.commentId))
    .returning()

  if (!comment) {
    throw new Error('Review thread comment was not found.')
  }

  return comment
}

export async function setReviewThreadStatus(
  threadId: string,
  status: 'open' | 'resolved',
): Promise<ReviewThreadRow | null> {
  const db = getDb()
  const [thread] = await db
    .update(reviewThreads)
    .set({ status, updatedAt: new Date() })
    .where(eq(reviewThreads.id, threadId))
    .returning()
  return thread ?? null
}
