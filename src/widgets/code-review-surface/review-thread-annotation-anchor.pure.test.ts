import { describe, expect, it } from 'vitest'
import {
  describeThreadAnchor,
  formatAnchorLineRange,
} from './review-thread-annotation-anchor.pure'

describe('describeThreadAnchor', () => {
  it('describes a single new-side line', () => {
    expect(
      describeThreadAnchor({ lineEnd: 8, lineStart: 8, side: 'new' }),
    ).toBe('new line 8')
  })

  it('describes an old-side line range', () => {
    expect(
      describeThreadAnchor({ lineEnd: 12, lineStart: 10, side: 'old' }),
    ).toBe('old lines 10-12')
  })
})

describe('formatAnchorLineRange', () => {
  it('collapses a single line to one number', () => {
    expect(formatAnchorLineRange({ lineEnd: 204, lineStart: 204 })).toBe('204')
  })

  it('keeps a multi-line range', () => {
    expect(formatAnchorLineRange({ lineEnd: 14, lineStart: 10 })).toBe('10-14')
  })
})
