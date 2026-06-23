import type {
  ReviewThreadAnchorRef,
  ReviewThreadDiffSide,
} from './review-thread.types'

/**
 * The minimal shape needed to read a thread's anchors: the primary anchor
 * columns plus the attached-selection list. Both the entity `ReviewThread` and
 * the database row satisfy this structurally, so the helpers work on either.
 */
export type ReviewThreadAnchorSource = {
  anchorCommitSha: string
  excerpt: string
  extraAnchors?: ReviewThreadAnchorRef[] | null
  filePath: string
  lineEnd: number
  lineStart: number
  side: ReviewThreadDiffSide
}

/**
 * The primary anchor in a thread's columns counts as "real" only when it names
 * a file. General (anchorless) discussions are created with empty sentinel
 * columns, so an empty `filePath` means there is no primary anchor — the whole
 * selection set, if any, lives in `extraAnchors`.
 */
export function reviewThreadHasPrimaryAnchor(thread: {
  filePath: string
}): boolean {
  return thread.filePath.trim() !== ''
}

/**
 * Every selection a thread references, as one ordered list: the primary anchor
 * (when real) followed by any attached selections. Inline threads always have a
 * primary; discussions may reference zero, one, or many selections.
 */
export function reviewThreadAnchors(
  thread: ReviewThreadAnchorSource,
): ReviewThreadAnchorRef[] {
  const primary = reviewThreadHasPrimaryAnchor(thread)
    ? [
        {
          anchorCommitSha: thread.anchorCommitSha,
          excerpt: thread.excerpt,
          filePath: thread.filePath,
          lineEnd: thread.lineEnd,
          lineStart: thread.lineStart,
          side: thread.side,
        },
      ]
    : []

  return [...primary, ...(thread.extraAnchors ?? [])]
}

/** Whether the thread references any diff selection at all. */
export function reviewThreadHasAnchor(
  thread: ReviewThreadAnchorSource,
): boolean {
  return reviewThreadAnchors(thread).length > 0
}
