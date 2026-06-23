import { describe, expect, it } from 'vitest'
import {
  reviewThreadAnchors,
  reviewThreadHasAnchor,
  reviewThreadHasPrimaryAnchor,
  type ReviewThreadAnchorSource,
} from './review-thread-anchors.pure'

const primary = {
  anchorCommitSha: 'sha-head',
  excerpt: '10: const a = 1',
  filePath: 'src/a.ts',
  lineEnd: 10,
  lineStart: 10,
  side: 'new' as const,
}

const extra = {
  anchorCommitSha: 'sha-head',
  excerpt: '20: const b = 2',
  filePath: 'src/b.ts',
  lineEnd: 20,
  lineStart: 20,
  side: 'new' as const,
}

const sentinel: ReviewThreadAnchorSource = {
  anchorCommitSha: 'sha-head',
  excerpt: '',
  extraAnchors: null,
  filePath: '',
  lineEnd: 0,
  lineStart: 0,
  side: 'new',
}

describe('reviewThreadHasPrimaryAnchor', () => {
  it('is true when filePath names a file', () => {
    expect(reviewThreadHasPrimaryAnchor(primary)).toBe(true)
  })

  it('is false for the empty sentinel filePath', () => {
    expect(reviewThreadHasPrimaryAnchor({ filePath: '' })).toBe(false)
    expect(reviewThreadHasPrimaryAnchor({ filePath: '   ' })).toBe(false)
  })
})

describe('reviewThreadAnchors', () => {
  it('returns the primary anchor followed by attached selections', () => {
    expect(reviewThreadAnchors({ ...primary, extraAnchors: [extra] })).toEqual([
      primary,
      extra,
    ])
  })

  it('returns only attached selections when there is no primary anchor', () => {
    expect(reviewThreadAnchors({ ...sentinel, extraAnchors: [extra] })).toEqual(
      [extra],
    )
  })

  it('returns an empty list for an anchorless discussion', () => {
    expect(reviewThreadAnchors(sentinel)).toEqual([])
  })
})

describe('reviewThreadHasAnchor', () => {
  it('is true with a primary anchor', () => {
    expect(reviewThreadHasAnchor({ ...primary, extraAnchors: null })).toBe(true)
  })

  it('is true with only attached selections', () => {
    expect(reviewThreadHasAnchor({ ...sentinel, extraAnchors: [extra] })).toBe(
      true,
    )
  })

  it('is false for an anchorless discussion', () => {
    expect(reviewThreadHasAnchor(sentinel)).toBe(false)
  })
})
