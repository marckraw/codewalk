/**
 * Maps the daemon's activity signal (or session status fallback) to a short
 * human label shown next to a pending agent comment.
 */
export function describeReviewAgentActivity(activity: string): string {
  if (activity.startsWith('tool:')) {
    const toolName = activity.slice('tool:'.length)
    return toolName ? `using ${toolName}` : 'using a tool'
  }

  switch (activity) {
    case 'streaming':
      return 'writing the answer'
    case 'thinking':
      return 'thinking'
    case 'compacting':
      return 'compacting context'
    case 'waiting-approval':
      return 'waiting for approval'
    case 'running':
      return 'working'
    case 'idle':
      return 'starting up'
    case 'starting':
      return 'starting up'
    default:
      return activity
  }
}
