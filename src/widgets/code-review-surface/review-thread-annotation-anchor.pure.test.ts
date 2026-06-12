import { describe, expect, it } from 'vitest'
import { describeThreadAnchor } from './review-thread-annotation-anchor.pure'

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
