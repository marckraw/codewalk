import 'server-only'

import {
  getReviewAgentSessionByDaemonSessionId,
  listReviewThreadsForPullRequest,
} from '@/entities/database'
import { advancePullRequestReviewAgentReply } from './pr-review-agent-reply.service'

/**
 * Reconciles a per-PR session after the daemon reports a turn finished. Runs
 * the same advance step a client poll would — but server-side, triggered by the
 * daemon callback — so the final reply is written to the DB without any browser
 * open. Per-PR turns are FIFO, so at most one thread is mid-turn; advancing the
 * in-flight ones completes (or errors) them from the daemon snapshot.
 */
export async function reconcileReviewAgentSessionCallback(
  daemonSessionId: string,
): Promise<void> {
  const session = await getReviewAgentSessionByDaemonSessionId(daemonSessionId)

  if (!session) {
    // Stale callback (session recreated with a new id, or never ours) — ignore.
    return
  }

  const threads = await listReviewThreadsForPullRequest({
    owner: session.owner,
    pullRequestNumber: session.pullRequestNumber,
    repo: session.repo,
  })

  const inFlight = threads.filter((thread) =>
    thread.comments.some(
      (comment) =>
        comment.authorType === 'agent' &&
        (comment.agentState === 'pending' ||
          comment.agentState === 'streaming'),
    ),
  )

  for (const thread of inFlight) {
    await advancePullRequestReviewAgentReply({ threadId: thread.id })
  }
}
