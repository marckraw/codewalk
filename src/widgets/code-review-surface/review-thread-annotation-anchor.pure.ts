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
