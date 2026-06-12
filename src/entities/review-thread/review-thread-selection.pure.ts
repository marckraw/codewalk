import type { SelectedLineRange, SelectionSide } from '@pierre/diffs'
import type { ReviewThreadDiffSide } from './review-thread.types'

export type ReviewThreadSelectionAnchor = {
  excerpt: string
  lineEnd: number
  lineStart: number
  side: ReviewThreadDiffSide
}

export type BuildReviewThreadSelectionAnchorResult =
  | { anchor: ReviewThreadSelectionAnchor; ok: true }
  | { error: string; ok: false }

export function buildReviewThreadSelectionAnchor(input: {
  patch: string
  range: SelectedLineRange | null
}): BuildReviewThreadSelectionAnchorResult {
  const normalized = normalizeReviewThreadSelection(input.range)

  if (!normalized.ok) {
    return normalized
  }

  const excerpt = extractDiffExcerpt({
    lineEnd: normalized.anchor.lineEnd,
    lineStart: normalized.anchor.lineStart,
    patch: input.patch,
    side: normalized.anchor.side,
  })

  return {
    anchor: {
      ...normalized.anchor,
      excerpt,
    },
    ok: true,
  }
}

export function normalizeReviewThreadSelection(
  range: SelectedLineRange | null,
): BuildReviewThreadSelectionAnchorResult {
  if (!range) {
    return {
      error: 'Select changed lines before starting a thread.',
      ok: false,
    }
  }

  const startSide = range.side ?? range.endSide ?? 'additions'
  const endSide = range.endSide ?? range.side ?? startSide

  if (startSide !== endSide) {
    return {
      error:
        'Thread anchors must stay on one side of the diff. Select old or new lines, not both.',
      ok: false,
    }
  }

  return {
    anchor: {
      excerpt: '',
      lineEnd: Math.max(range.start, range.end),
      lineStart: Math.min(range.start, range.end),
      side: reviewThreadDiffSideFromPierreSide(startSide),
    },
    ok: true,
  }
}

/**
 * Shift-click range extension: when the reviewer shift-clicks a line while a
 * selection exists on the same side, the selection grows to span both ranges
 * (GitHub's gutter behavior). Any other combination replaces the selection.
 */
export function extendReviewThreadSelection(input: {
  next: SelectedLineRange | null
  previous: SelectedLineRange | null
  shiftKey: boolean
}): SelectedLineRange | null {
  const { next, previous, shiftKey } = input

  if (!shiftKey || !previous || !next) {
    return next
  }

  const previousSide = previous.side ?? previous.endSide ?? 'additions'
  const nextSide = next.side ?? next.endSide ?? 'additions'

  if (previousSide !== nextSide) {
    return next
  }

  return {
    end: Math.max(previous.start, previous.end, next.start, next.end),
    endSide: nextSide,
    side: nextSide,
    start: Math.min(previous.start, previous.end, next.start, next.end),
  }
}

export function reviewThreadDiffSideFromPierreSide(
  side: SelectionSide,
): ReviewThreadDiffSide {
  return side === 'deletions' ? 'old' : 'new'
}

export function pierreSideFromReviewThreadDiffSide(
  side: ReviewThreadDiffSide,
): SelectionSide {
  return side === 'old' ? 'deletions' : 'additions'
}

export function extractDiffExcerpt(input: {
  lineEnd: number
  lineStart: number
  patch: string
  side: ReviewThreadDiffSide
}): string {
  const selectedLines: string[] = []
  let oldLine: number | null = null
  let newLine: number | null = null

  for (const rawLine of input.patch.split('\n')) {
    if (rawLine.startsWith('@@')) {
      const hunk = parseHunkHeader(rawLine)
      oldLine = hunk?.oldStart ?? null
      newLine = hunk?.newStart ?? null
      continue
    }

    if (oldLine === null || newLine === null || rawLine.startsWith('\\')) {
      continue
    }

    const marker = rawLine[0]
    const content = rawLine.slice(1)

    if (marker === ' ' || marker === '-') {
      if (input.side === 'old' && isLineInRange(oldLine, input)) {
        selectedLines.push(`${oldLine}: ${content}`)
      }
      oldLine += 1
    }

    if (marker === ' ' || marker === '+') {
      if (input.side === 'new' && isLineInRange(newLine, input)) {
        selectedLines.push(`${newLine}: ${content}`)
      }
      newLine += 1
    }
  }

  return (
    selectedLines.join('\n') ||
    `${input.side === 'old' ? 'Old' : 'New'} lines ${input.lineStart}-${input.lineEnd}`
  )
}

function parseHunkHeader(line: string): {
  newStart: number
  oldStart: number
} | null {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)

  if (!match) {
    return null
  }

  return {
    newStart: Number(match[2]),
    oldStart: Number(match[1]),
  }
}

function isLineInRange(
  lineNumber: number,
  range: { lineEnd: number; lineStart: number },
) {
  return lineNumber >= range.lineStart && lineNumber <= range.lineEnd
}
