import 'server-only'

import { asc, and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type {
  ReviewThreadAgentState,
  ReviewThreadAnchorRef,
  ReviewThreadCommentAuthorType,
  ReviewThreadCommentKind,
  ReviewThreadCommentRow,
  ReviewThreadDiffSide,
  ReviewThreadFixState,
  ReviewThreadKind,
  ReviewThreadRow,
} from './schema'
import { getDb } from './client'
import { reviewThreadComments, reviewThreads, users } from './schema'

/**
 * A comment plus its author's display name (resolved from the users table).
 * Optional so plain row fixtures stay assignable; queries always populate it.
 */
export type ReviewThreadCommentRecord = ReviewThreadCommentRow & {
  authorName?: string | null
}

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
  extraAnchors?: ReviewThreadAnchorRef[] | null
  kind?: ReviewThreadKind
  createdByUserId: string
}

export type ReviewThreadCommentInsert = {
  threadId: string
  authorType: ReviewThreadCommentAuthorType
  authorUserId: string | null
  body: string
  agentState?: ReviewThreadAgentState | null
  agentSeqStart?: number | null
  commentKind?: ReviewThreadCommentKind
  fixState?: ReviewThreadFixState | null
  commitSha?: string | null
}

export type ReviewThreadCommentUpdate = {
  agentSeqStart?: number | null
  agentState?: ReviewThreadAgentState | null
  body?: string
  commentId: string
  fixState?: ReviewThreadFixState | null
  commitSha?: string | null
}

export type ReviewThreadWithComments = ReviewThreadRow & {
  comments: ReviewThreadCommentRecord[]
}

/** Unique, non-null author ids across a set of comments. */
export function collectCommentAuthorIds(
  comments: ReviewThreadCommentRow[],
): string[] {
  return [
    ...new Set(
      comments
        .map((comment) => comment.authorUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
}

/**
 * Attach each comment's author display name from a prefetched name map. Agent
 * and authorless comments resolve to null; the UI renders those by author type.
 */
export function mapCommentsWithAuthors(
  comments: ReviewThreadCommentRow[],
  nameById: Map<string, string | null>,
): ReviewThreadCommentRecord[] {
  return comments.map((comment) => ({
    ...comment,
    authorName: comment.authorUserId
      ? (nameById.get(comment.authorUserId) ?? null)
      : null,
  }))
}

/** Group comments by their thread id, preserving the given order. */
export function groupCommentsByThreadId(
  comments: ReviewThreadCommentRow[],
): Map<string, ReviewThreadCommentRow[]> {
  const byThread = new Map<string, ReviewThreadCommentRow[]>()
  for (const comment of comments) {
    const list = byThread.get(comment.threadId)
    if (list) {
      list.push(comment)
    } else {
      byThread.set(comment.threadId, [comment])
    }
  }
  return byThread
}

/** Resolve display names for the given author ids in a single query. */
async function fetchAuthorNames(
  authorIds: string[],
): Promise<Map<string, string | null>> {
  if (authorIds.length === 0) {
    return new Map()
  }

  const db = getDb()
  const authors = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, authorIds))
  return new Map(authors.map((author) => [author.id, author.name]))
}

/**
 * Resolves each comment's author display name from the users table. Agent and
 * authorless comments resolve to null; the UI renders those by author type.
 */
async function attachCommentAuthors(
  comments: ReviewThreadCommentRow[],
): Promise<ReviewThreadCommentRecord[]> {
  const nameById = await fetchAuthorNames(collectCommentAuthorIds(comments))
  return mapCommentsWithAuthors(comments, nameById)
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
    extraAnchors: input.extraAnchors ?? null,
    kind: input.kind ?? 'inline',
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
    commentKind: input.commentKind ?? 'message',
    fixState: input.fixState ?? null,
    commitSha: input.commitSha ?? null,
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
  return { ...thread, comments: await attachCommentAuthors([comment]) }
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

  // Batch: fetch every thread's comments in one query and all author names in
  // one more, then group/attach in memory. Replaces the prior 1 + 2N
  // sequential round-trips (a comments query and a users query per thread) —
  // a real win on Neon serverless where each query carries network latency.
  const threadIds = threads.map((thread) => thread.id)
  const comments = await db
    .select()
    .from(reviewThreadComments)
    .where(inArray(reviewThreadComments.threadId, threadIds))
    .orderBy(asc(reviewThreadComments.createdAt))

  const nameById = await fetchAuthorNames(collectCommentAuthorIds(comments))
  const commentsByThread = groupCommentsByThreadId(comments)

  return threads.map((thread) => ({
    ...thread,
    comments: mapCommentsWithAuthors(
      commentsByThread.get(thread.id) ?? [],
      nameById,
    ),
  }))
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
  return { ...thread, comments: await attachCommentAuthors(comments) }
}

export async function addReviewThreadComment(
  input: ReviewThreadCommentInsert,
): Promise<ReviewThreadCommentRecord> {
  const db = getDb()
  const [comment] = await db
    .insert(reviewThreadComments)
    .values(buildReviewThreadCommentRow(input))
    .returning()
  await db
    .update(reviewThreads)
    .set({ updatedAt: new Date() })
    .where(eq(reviewThreads.id, input.threadId))
  const [record] = await attachCommentAuthors([comment])
  return record
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
      ...(input.fixState === undefined ? {} : { fixState: input.fixState }),
      ...(input.commitSha === undefined ? {} : { commitSha: input.commitSha }),
    })
    .where(eq(reviewThreadComments.id, input.commentId))
    .returning()

  if (!comment) {
    throw new Error('Review thread comment was not found.')
  }

  return comment
}

/**
 * Optimistic claim of a pending agent comment before sending its question to
 * the daemon: the seq is only written when no other process claimed it first
 * (agent_seq_start still null). Returns null when the claim was lost.
 */
export async function claimReviewThreadAgentTurn(input: {
  agentSeqStart: number
  commentId: string
}): Promise<ReviewThreadCommentRow | null> {
  const db = getDb()
  const [comment] = await db
    .update(reviewThreadComments)
    .set({ agentSeqStart: input.agentSeqStart })
    .where(
      and(
        eq(reviewThreadComments.id, input.commentId),
        eq(reviewThreadComments.agentState, 'pending'),
        isNull(reviewThreadComments.agentSeqStart),
      ),
    )
    .returning()

  return comment ?? null
}

/** Open thread rows for a PR, without their comments — for bulk passes. */
export async function listOpenReviewThreadRowsForPullRequest(input: {
  owner: string
  repo: string
  pullRequestNumber: number
}): Promise<ReviewThreadRow[]> {
  const db = getDb()

  return db
    .select()
    .from(reviewThreads)
    .where(
      and(
        eq(reviewThreads.owner, input.owner.toLowerCase()),
        eq(reviewThreads.repo, input.repo.toLowerCase()),
        eq(reviewThreads.pullRequestNumber, input.pullRequestNumber),
        eq(reviewThreads.status, 'open'),
      ),
    )
}

/**
 * Appends diff selections to a thread's reference list (P6 discussions: anchors
 * attached after the conversation started). Returns the full updated thread, or
 * null when the thread no longer exists. New anchors land in `extraAnchors`; for
 * a general discussion that list is the entire selection set.
 */
export async function appendReviewThreadAnchors(input: {
  anchors: ReviewThreadAnchorRef[]
  threadId: string
}): Promise<ReviewThreadWithComments | null> {
  if (input.anchors.length === 0) {
    return getReviewThread(input.threadId)
  }

  const db = getDb()
  const existing = await getReviewThread(input.threadId)

  if (!existing) {
    return null
  }

  const nextAnchors = [...(existing.extraAnchors ?? []), ...input.anchors]
  await db
    .update(reviewThreads)
    .set({ extraAnchors: nextAnchors, updatedAt: new Date() })
    .where(eq(reviewThreads.id, input.threadId))

  return getReviewThread(input.threadId)
}

export async function setReviewThreadStatus(
  threadId: string,
  status: 'open' | 'resolved' | 'outdated',
): Promise<ReviewThreadRow | null> {
  const db = getDb()
  const [thread] = await db
    .update(reviewThreads)
    .set({ status, updatedAt: new Date() })
    .where(eq(reviewThreads.id, threadId))
    .returning()
  return thread ?? null
}
