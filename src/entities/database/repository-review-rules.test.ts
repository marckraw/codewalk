import { describe, expect, it, vi } from 'vitest'
import { buildRepositoryReviewRuleRow } from './repository-review-rules'

vi.mock('server-only', () => ({}))

describe('buildRepositoryReviewRuleRow', () => {
  it('normalizes owner and repo to lowercase', () => {
    expect(
      buildRepositoryReviewRuleRow({
        createdByUserId: 'user-id',
        owner: 'Acme',
        repo: 'Widgets',
        rule: 'allow',
      }),
    ).toEqual({
      createdByUserId: 'user-id',
      owner: 'acme',
      repo: 'widgets',
      rule: 'allow',
    })
  })

  it('keeps block rules and null creators intact', () => {
    expect(
      buildRepositoryReviewRuleRow({
        createdByUserId: null,
        owner: 'ef-global',
        repo: 'noisy-repo',
        rule: 'block',
      }),
    ).toEqual({
      createdByUserId: null,
      owner: 'ef-global',
      repo: 'noisy-repo',
      rule: 'block',
    })
  })
})
