import { Badge } from '@/shared/ui/badge'
import type { PullRequestLifecycleStatus } from '@/entities/github'

const PR_STATUS_LABEL: Record<PullRequestLifecycleStatus, string> = {
  closed: 'closed',
  draft: 'draft',
  merged: 'merged',
  ready_for_review: 'ready for review',
  unknown: 'unknown',
}

// Mirror GitHub's PR state colors: open/ready green, draft gray,
// merged purple, closed red.
const PR_STATUS_TONE: Record<
  PullRequestLifecycleStatus,
  'success' | 'warning' | 'danger' | 'muted' | 'merged'
> = {
  closed: 'danger',
  draft: 'muted',
  merged: 'merged',
  ready_for_review: 'success',
  unknown: 'muted',
}

export function PullRequestStatusBadge({
  status,
}: {
  status: PullRequestLifecycleStatus
}) {
  return <Badge tone={PR_STATUS_TONE[status]}>{PR_STATUS_LABEL[status]}</Badge>
}
