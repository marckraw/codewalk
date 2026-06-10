export type PullRequestLifecycleStatus =
  | 'draft'
  | 'ready_for_review'
  | 'closed'
  | 'merged'
  | 'unknown'

export function derivePullRequestLifecycleStatus(input: {
  draft?: boolean | null
  mergedAt?: Date | string | null
  state?: string | null
}): PullRequestLifecycleStatus {
  if (input.mergedAt) {
    return 'merged'
  }

  if (input.state === 'closed') {
    return 'closed'
  }

  if (input.state === 'open' && input.draft) {
    return 'draft'
  }

  if (input.state === 'open') {
    return 'ready_for_review'
  }

  return 'unknown'
}
