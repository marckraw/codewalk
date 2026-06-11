import { describe, expect, it, vi } from 'vitest'
import {
  buildFinishCodeReviewGuideGenerationRow,
  buildStartCodeReviewGuideGenerationRow,
} from './code-review-guide-generations'

vi.mock('server-only', () => ({}))

describe('code review guide generation rows', () => {
  it('builds a running generation row', () => {
    const now = new Date('2026-06-09T08:00:00.000Z')

    expect(
      buildStartCodeReviewGuideGenerationRow(
        {
          effort: 'high',
          force: true,
          model: 'gpt-5.4',
          provider: 'codex',
          requestedByUserId: 'user-id',
          snapshotId: 'snapshot-id',
        },
        now,
      ),
    ).toEqual({
      daemonCallbackSecret: null,
      daemonJobId: null,
      effort: 'high',
      error: null,
      finishedAt: null,
      force: true,
      guideId: null,
      githubCommentId: null,
      githubCommentUrl: null,
      model: 'gpt-5.4',
      provider: 'codex',
      requestedByUserId: 'user-id',
      snapshotId: 'snapshot-id',
      startedAt: now,
      status: 'running',
      updatedAt: now,
    })
  })

  it('builds a finished generation row', () => {
    const now = new Date('2026-06-09T08:01:00.000Z')

    expect(
      buildFinishCodeReviewGuideGenerationRow(
        {
          error: null,
          guideId: 'guide-id',
          snapshotId: 'snapshot-id',
          status: 'ready',
        },
        now,
      ),
    ).toEqual({
      error: null,
      finishedAt: now,
      guideId: 'guide-id',
      status: 'ready',
      updatedAt: now,
    })
  })
})
