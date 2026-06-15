import { describe, expect, it, vi } from 'vitest'
import {
  buildReviewThreadCommentRow,
  buildReviewThreadRow,
  collectCommentAuthorIds,
  groupCommentsByThreadId,
  mapCommentsWithAuthors,
} from './review-threads'
import type { ReviewThreadCommentRow } from './schema'

vi.mock('server-only', () => ({}))

function comment(
  overrides: Partial<ReviewThreadCommentRow> & {
    id: string
    threadId: string
  },
): ReviewThreadCommentRow {
  return {
    authorType: 'user',
    authorUserId: null,
    body: '',
    agentState: null,
    agentSeqStart: null,
    commentKind: 'message',
    fixState: null,
    commitSha: null,
    createdAt: new Date('2026-06-15T00:00:00Z'),
    ...overrides,
  } as unknown as ReviewThreadCommentRow
}

describe('buildReviewThreadRow', () => {
  it('lowercases the repository identity and keeps anchor fields', () => {
    expect(
      buildReviewThreadRow({
        owner: 'EF-Global',
        repo: 'Backpack',
        pullRequestNumber: 42,
        anchorSnapshotId: 'snap-1',
        anchorCommitSha: 'abc123',
        filePath: 'src/index.ts',
        side: 'new',
        lineStart: 10,
        lineEnd: 14,
        excerpt: 'const x = 1',
        createdByUserId: 'user-1',
      }),
    ).toEqual({
      owner: 'ef-global',
      repo: 'backpack',
      pullRequestNumber: 42,
      anchorSnapshotId: 'snap-1',
      anchorCommitSha: 'abc123',
      filePath: 'src/index.ts',
      side: 'new',
      lineStart: 10,
      lineEnd: 14,
      excerpt: 'const x = 1',
      extraAnchors: null,
      kind: 'inline',
      createdByUserId: 'user-1',
    })
  })

  it('normalizes reversed line ranges', () => {
    const row = buildReviewThreadRow({
      owner: 'a',
      repo: 'b',
      pullRequestNumber: 1,
      anchorSnapshotId: null,
      anchorCommitSha: 'sha',
      filePath: 'f.ts',
      side: 'old',
      lineStart: 20,
      lineEnd: 12,
      excerpt: 'x',
      createdByUserId: 'user-1',
    })
    expect(row.lineStart).toBe(12)
    expect(row.lineEnd).toBe(20)
  })
})

describe('buildReviewThreadCommentRow', () => {
  it('defaults agentState to null for user comments', () => {
    expect(
      buildReviewThreadCommentRow({
        threadId: 't-1',
        authorType: 'user',
        authorUserId: 'user-1',
        body: 'why does this work?',
      }),
    ).toEqual({
      threadId: 't-1',
      authorType: 'user',
      authorUserId: 'user-1',
      body: 'why does this work?',
      agentState: null,
      agentSeqStart: null,
      commentKind: 'message',
      fixState: null,
      commitSha: null,
    })
  })

  it('keeps agent comments with their state and no user author', () => {
    expect(
      buildReviewThreadCommentRow({
        threadId: 't-1',
        authorType: 'agent',
        authorUserId: null,
        body: '',
        agentState: 'pending',
        agentSeqStart: 17,
      }),
    ).toMatchObject({
      authorType: 'agent',
      agentState: 'pending',
      agentSeqStart: 17,
    })
  })

  it('carries a fix-proposal kind and commit sha through', () => {
    expect(
      buildReviewThreadCommentRow({
        threadId: 't-1',
        authorType: 'agent',
        authorUserId: null,
        body: 'Pushed abc to feature/x',
        commentKind: 'system',
        commitSha: 'abc1234',
      }),
    ).toMatchObject({
      commentKind: 'system',
      commitSha: 'abc1234',
      fixState: null,
    })
  })
})

describe('collectCommentAuthorIds', () => {
  it('returns unique non-null author ids', () => {
    expect(
      collectCommentAuthorIds([
        comment({ id: 'c1', threadId: 't1', authorUserId: 'u1' }),
        comment({ id: 'c2', threadId: 't1', authorUserId: 'u1' }),
        comment({ id: 'c3', threadId: 't1', authorUserId: null }),
        comment({ id: 'c4', threadId: 't2', authorUserId: 'u2' }),
      ]),
    ).toEqual(['u1', 'u2'])
  })

  it('is empty when no comment has an author', () => {
    expect(
      collectCommentAuthorIds([comment({ id: 'c1', threadId: 't1' })]),
    ).toEqual([])
  })
})

describe('mapCommentsWithAuthors', () => {
  it('resolves names and leaves authorless/unknown comments null', () => {
    const nameById = new Map<string, string | null>([
      ['u1', 'Ada'],
      ['u2', null],
    ])
    const result = mapCommentsWithAuthors(
      [
        comment({ id: 'c1', threadId: 't1', authorUserId: 'u1' }),
        comment({ id: 'c2', threadId: 't1', authorUserId: 'u2' }),
        comment({ id: 'c3', threadId: 't1', authorUserId: 'u-missing' }),
        comment({ id: 'c4', threadId: 't1', authorUserId: null }),
      ],
      nameById,
    )
    expect(result.map((c) => c.authorName)).toEqual(['Ada', null, null, null])
  })
})

describe('groupCommentsByThreadId', () => {
  it('groups comments by thread id preserving order', () => {
    const grouped = groupCommentsByThreadId([
      comment({ id: 'c1', threadId: 't1' }),
      comment({ id: 'c2', threadId: 't2' }),
      comment({ id: 'c3', threadId: 't1' }),
    ])
    expect(grouped.get('t1')?.map((c) => c.id)).toEqual(['c1', 'c3'])
    expect(grouped.get('t2')?.map((c) => c.id)).toEqual(['c2'])
    expect(grouped.get('t3')).toBeUndefined()
  })
})
