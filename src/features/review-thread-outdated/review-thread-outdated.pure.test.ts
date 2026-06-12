import { describe, expect, it } from 'vitest'
import { shouldMarkThreadOutdated } from './review-thread-outdated.pure'

describe('shouldMarkThreadOutdated', () => {
  it('keeps threads anchored to the new head', () => {
    expect(
      shouldMarkThreadOutdated({
        anchorCommitSha: 'head-2',
        anchorPatch: null,
        newHeadSha: 'head-2',
        newPatch: null,
      }),
    ).toBe(false)
  })

  it('keeps older threads whose file diff is unchanged', () => {
    expect(
      shouldMarkThreadOutdated({
        anchorCommitSha: 'head-1',
        anchorPatch: '@@ -1 +1 @@\n-a\n+b',
        newHeadSha: 'head-2',
        newPatch: '@@ -1 +1 @@\n-a\n+b',
      }),
    ).toBe(false)
  })

  it('marks threads whose file diff changed', () => {
    expect(
      shouldMarkThreadOutdated({
        anchorCommitSha: 'head-1',
        anchorPatch: '@@ -1 +1 @@\n-a\n+b',
        newHeadSha: 'head-2',
        newPatch: '@@ -1 +1 @@\n-a\n+c',
      }),
    ).toBe(true)
  })

  it('marks threads whose file left the diff or whose anchor is gone', () => {
    expect(
      shouldMarkThreadOutdated({
        anchorCommitSha: 'head-1',
        anchorPatch: '@@ -1 +1 @@\n-a\n+b',
        newHeadSha: 'head-2',
        newPatch: null,
      }),
    ).toBe(true)
    expect(
      shouldMarkThreadOutdated({
        anchorCommitSha: 'head-1',
        anchorPatch: null,
        newHeadSha: 'head-2',
        newPatch: '@@ -1 +1 @@\n-a\n+b',
      }),
    ).toBe(true)
  })
})
