import { describe, expect, it } from 'vitest'
import {
  MIN_RECONCILE_GENERATION_AGE_MS,
  shouldReconcileCodeReviewGuideGeneration,
} from './code-review-guide-generation.pure'

describe('shouldReconcileCodeReviewGuideGeneration', () => {
  const now = new Date('2026-06-11T12:00:00Z')

  function generation(overrides: Record<string, unknown> = {}) {
    return {
      daemonJobId: 'job-1',
      startedAt: new Date(now.getTime() - MIN_RECONCILE_GENERATION_AGE_MS),
      status: 'running',
      ...overrides,
    } as never
  }

  it('reconciles a running generation with a job past the freshness window', () => {
    expect(shouldReconcileCodeReviewGuideGeneration(generation(), now)).toEqual(
      {
        daemonJobId: 'job-1',
        reconcile: true,
      },
    )
  })

  it('skips missing, terminal, and job-less generations', () => {
    expect(shouldReconcileCodeReviewGuideGeneration(null, now)).toEqual({
      reconcile: false,
      reason: 'no-generation',
    })
    expect(
      shouldReconcileCodeReviewGuideGeneration(
        generation({ status: 'ready' }),
        now,
      ),
    ).toEqual({ reconcile: false, reason: 'not-running' })
    expect(
      shouldReconcileCodeReviewGuideGeneration(
        generation({ daemonJobId: null }),
        now,
      ),
    ).toEqual({ reconcile: false, reason: 'no-job' })
  })

  it('skips rows started moments ago (submit may still be in flight)', () => {
    expect(
      shouldReconcileCodeReviewGuideGeneration(
        generation({ startedAt: new Date(now.getTime() - 1) }),
        now,
      ),
    ).toEqual({ reconcile: false, reason: 'too-fresh' })
  })

  it('accepts ISO-string startedAt values', () => {
    expect(
      shouldReconcileCodeReviewGuideGeneration(
        generation({ startedAt: '2026-06-11T11:00:00Z' }),
        now,
      ),
    ).toEqual({ daemonJobId: 'job-1', reconcile: true })
  })
})
