import { describe, expect, it } from 'vitest'
import { derivePullRequestLifecycleStatus } from './pull-request-lifecycle.pure'

describe('derivePullRequestLifecycleStatus', () => {
  it('distinguishes draft, ready, closed, merged, and unknown pull request states', () => {
    expect(
      derivePullRequestLifecycleStatus({
        draft: true,
        mergedAt: null,
        state: 'open',
      }),
    ).toBe('draft')
    expect(
      derivePullRequestLifecycleStatus({
        draft: false,
        mergedAt: null,
        state: 'open',
      }),
    ).toBe('ready_for_review')
    expect(
      derivePullRequestLifecycleStatus({
        draft: false,
        mergedAt: null,
        state: 'closed',
      }),
    ).toBe('closed')
    expect(
      derivePullRequestLifecycleStatus({
        draft: false,
        mergedAt: '2026-06-09T08:00:00Z',
        state: 'closed',
      }),
    ).toBe('merged')
    expect(
      derivePullRequestLifecycleStatus({
        draft: false,
        mergedAt: null,
        state: 'weird',
      }),
    ).toBe('unknown')
  })
})
