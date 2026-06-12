import { describe, expect, it } from 'vitest'
import {
  buildPullRequestReviewAgentInitialPrompt,
  buildPullRequestReviewAgentSessionId,
} from './pr-review-agent-session.pure'

describe('PR review agent session helpers', () => {
  it('builds a stable daemon-safe session id prefix', () => {
    expect(
      buildPullRequestReviewAgentSessionId({
        nonce: 'A/B:C',
        number: 42,
        owner: 'EF-Global',
        repo: 'Backpack Suite',
      }),
    ).toBe('codewalk-pr-ef-global-backpack-suite-42-a-b-c')
  })

  it('builds an initial prompt scoped to the pull request', () => {
    expect(
      buildPullRequestReviewAgentInitialPrompt({
        baseRef: 'main',
        headRef: 'feature/review',
        number: 42,
        owner: 'ef-global',
        repo: 'backpack',
        title: 'Improve review guide',
        url: 'https://github.com/ef-global/backpack/pull/42',
      }),
    ).toContain('ef-global/backpack#42')
  })
})
