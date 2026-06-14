import type { ReviewThread } from '@/entities/review-thread'

export function describeThreadAnchor(
  anchor: Pick<ReviewThread, 'lineEnd' | 'lineStart' | 'side'>,
) {
  const sideLabel = anchor.side === 'old' ? 'old' : 'new'
  const lines =
    anchor.lineStart === anchor.lineEnd
      ? `line ${anchor.lineStart}`
      : `lines ${anchor.lineStart}-${anchor.lineEnd}`

  return `${sideLabel} ${lines}`
}

/**
 * Compact line label for anchor reference chips: a single line renders as `8`,
 * a range as `10-12`.
 */
export function formatAnchorLineRange(
  anchor: Pick<ReviewThread, 'lineEnd' | 'lineStart'>,
): string {
  return anchor.lineStart === anchor.lineEnd
    ? `${anchor.lineStart}`
    : `${anchor.lineStart}-${anchor.lineEnd}`
}
