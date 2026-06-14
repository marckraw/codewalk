import { describe, expect, it, vi } from 'vitest'
import {
  buildReviewThreadCommentRow,
  buildReviewThreadRow,
} from './review-threads'

vi.mock('server-only', () => ({}))

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
