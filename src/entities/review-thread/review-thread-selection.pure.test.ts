import { describe, expect, it } from 'vitest'
import {
  buildReviewThreadSelectionAnchor,
  extendReviewThreadSelection,
  extractDiffExcerpt,
  normalizeReviewThreadSelection,
  parseReviewThreadExtraAnchors,
  pierreSideFromReviewThreadDiffSide,
  reviewThreadDiffSideFromPierreSide,
} from './review-thread-selection.pure'

describe('parseReviewThreadExtraAnchors', () => {
  it('keeps valid anchors and normalizes line ranges', () => {
    expect(
      parseReviewThreadExtraAnchors([
        {
          anchorCommitSha: 'sha1',
          excerpt: 'const a = 1',
          filePath: 'src/a.ts',
          lineEnd: 5,
          lineStart: 9,
          side: 'new',
        },
      ]),
    ).toEqual([
      {
        anchorCommitSha: 'sha1',
        excerpt: 'const a = 1',
        filePath: 'src/a.ts',
        lineEnd: 9,
        lineStart: 5,
        side: 'new',
      },
    ])
  })

  it('drops malformed entries and non-arrays', () => {
    expect(parseReviewThreadExtraAnchors(null)).toEqual([])
    expect(
      parseReviewThreadExtraAnchors([
        {
          filePath: '',
          side: 'new',
          lineStart: 1,
          lineEnd: 2,
          excerpt: 'x',
          anchorCommitSha: 's',
        },
        {
          filePath: 'a.ts',
          side: 'sideways',
          lineStart: 1,
          lineEnd: 2,
          excerpt: 'x',
          anchorCommitSha: 's',
        },
        {
          filePath: 'a.ts',
          side: 'new',
          lineStart: 1.5,
          lineEnd: 2,
          excerpt: 'x',
          anchorCommitSha: 's',
        },
        'not-an-object',
      ]),
    ).toEqual([])
  })
})

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

describe('extendReviewThreadSelection', () => {
  const previous = { end: 12, side: 'additions' as const, start: 10 }

  it('replaces the selection without shift', () => {
    const next = { end: 20, side: 'additions' as const, start: 20 }
    expect(
      extendReviewThreadSelection({ next, previous, shiftKey: false }),
    ).toBe(next)
  })

  it('extends the selection to span both ranges with shift', () => {
    expect(
      extendReviewThreadSelection({
        next: { end: 20, side: 'additions' as const, start: 20 },
        previous,
        shiftKey: true,
      }),
    ).toEqual({ end: 20, endSide: 'additions', side: 'additions', start: 10 })
  })

  it('extends upward when the shift-clicked line is above', () => {
    expect(
      extendReviewThreadSelection({
        next: { end: 4, side: 'additions' as const, start: 4 },
        previous,
        shiftKey: true,
      }),
    ).toEqual({ end: 12, endSide: 'additions', side: 'additions', start: 4 })
  })

  it('replaces the selection when sides differ', () => {
    const next = { end: 20, side: 'deletions' as const, start: 20 }
    expect(
      extendReviewThreadSelection({ next, previous, shiftKey: true }),
    ).toBe(next)
  })

  it('passes through null and first selections', () => {
    expect(
      extendReviewThreadSelection({ next: null, previous, shiftKey: true }),
    ).toBeNull()
    expect(
      extendReviewThreadSelection({
        next: previous,
        previous: null,
        shiftKey: true,
      }),
    ).toBe(previous)
  })
})
