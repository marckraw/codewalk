import { describe, expect, it } from 'vitest'
import {
  buildReviewThreadSelectionAnchor,
  extractDiffExcerpt,
  normalizeReviewThreadSelection,
  pierreSideFromReviewThreadDiffSide,
  reviewThreadDiffSideFromPierreSide,
} from './review-thread-selection.pure'

describe('review thread selection helpers', () => {
  it('normalizes a Pierre additions selection into a new-side anchor', () => {
    expect(
      normalizeReviewThreadSelection({
        end: 12,
        side: 'additions',
        start: 10,
      }),
    ).toEqual({
      anchor: {
        excerpt: '',
        lineEnd: 12,
        lineStart: 10,
        side: 'new',
      },
      ok: true,
    })
  })

  it('normalizes reversed deletions selections into an old-side anchor', () => {
    expect(
      normalizeReviewThreadSelection({
        end: 3,
        side: 'deletions',
        start: 5,
      }),
    ).toEqual({
      anchor: {
        excerpt: '',
        lineEnd: 5,
        lineStart: 3,
        side: 'old',
      },
      ok: true,
    })
  })

  it('rejects mixed-side selections', () => {
    expect(
      normalizeReviewThreadSelection({
        end: 5,
        endSide: 'deletions',
        side: 'additions',
        start: 5,
      }),
    ).toEqual({
      error:
        'Thread anchors must stay on one side of the diff. Select old or new lines, not both.',
      ok: false,
    })
  })

  it('maps diff sides to Pierre annotation sides', () => {
    expect(reviewThreadDiffSideFromPierreSide('deletions')).toBe('old')
    expect(reviewThreadDiffSideFromPierreSide('additions')).toBe('new')
    expect(pierreSideFromReviewThreadDiffSide('old')).toBe('deletions')
    expect(pierreSideFromReviewThreadDiffSide('new')).toBe('additions')
  })

  it('extracts selected new-side lines from a unified patch', () => {
    const patch = [
      '@@ -10,4 +10,5 @@',
      ' context',
      '-old call',
      '+new call',
      '+another call',
      ' tail',
    ].join('\n')

    expect(
      extractDiffExcerpt({
        lineEnd: 12,
        lineStart: 11,
        patch,
        side: 'new',
      }),
    ).toBe(['11: new call', '12: another call'].join('\n'))
  })

  it('extracts selected old-side lines from a unified patch', () => {
    const patch = [
      '@@ -10,4 +10,5 @@',
      ' context',
      '-old call',
      '+new call',
      '+another call',
      ' tail',
    ].join('\n')

    expect(
      extractDiffExcerpt({
        lineEnd: 11,
        lineStart: 10,
        patch,
        side: 'old',
      }),
    ).toBe(['10: context', '11: old call'].join('\n'))
  })

  it('builds an anchor with excerpt in one step', () => {
    expect(
      buildReviewThreadSelectionAnchor({
        patch: '@@ -1 +1 @@\n-old\n+new',
        range: {
          end: 1,
          side: 'additions',
          start: 1,
        },
      }),
    ).toEqual({
      anchor: {
        excerpt: '1: new',
        lineEnd: 1,
        lineStart: 1,
        side: 'new',
      },
      ok: true,
    })
  })
})
