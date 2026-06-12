import 'server-only'

import {
  AgentsDaemonClient,
  AgentsDaemonClientError,
  getAgentsDaemonConfig,
  parseAgentsDaemonConversationItems,
  type AgentsDaemonExecutionSessionSnapshot,
} from '@/entities/agents-daemon'
import {
  addReviewThreadComment,
  claimReviewThreadAgentTurn,
  getReviewAgentSessionForPullRequest,
  getReviewThread,
  updateReviewAgentSessionFromSnapshot,
  updateReviewThreadComment,
  type ReviewThreadCommentRow,
  type ReviewThreadWithComments,
} from '@/entities/database'
import {
  ensurePullRequestReviewAgentSession,
  PullRequestReviewAgentSessionError,
} from './pr-review-agent-session.service'
import {
  buildReviewThreadAgentQuestionPrompt,
  extractAgentReplyAfterLastUserMessage,
} from './pr-review-agent-session.pure'

export type ReviewAgentReplyClient = Pick<
  AgentsDaemonClient,
  | 'getExecutionSession'
  | 'sendExecutionSessionMessage'
  | 'startExecutionSession'
>

export type ReviewAgentReplyResult = {
  thread: ReviewThreadWithComments
}

/**
 * Starts an agent reply for the latest reviewer question in the thread and
 * returns immediately: a pending agent comment is persisted, the daemon
 * session is ensured, and — when the session is already idle — the question
 * is sent. Turn completion is observed by advancePullRequestReviewAgentReply,
 * which the client polls. Nothing here outlives a short request, so serverless
 * time limits cannot kill a turn half-way anymore: a dying process leaves a
 * pending comment that the next poll adopts and finishes.
 */
export async function startPullRequestReviewAgentReply(input: {
  client?: ReviewAgentReplyClient
  requestedByUserId: string | null
  threadId: string
}): Promise<ReviewAgentReplyResult> {
  const thread = await getReviewThread(input.threadId)

  if (!thread) {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'Review thread was not found.',
      404,
    )
  }

  if (!latestReviewerQuestion(thread)) {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'The thread has no reviewer question to answer.',
      400,
    )
  }

  if (!thread.anchorSnapshotId) {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'The thread is not linked to an imported pull request snapshot.',
      409,
    )
  }

  if (thread.comments.some(isPendingAgentComment)) {
    // An agent turn for this thread is already in flight; polling will pick
    // it up. Do not stack a second pending comment.
    return { thread }
  }

  await addReviewThreadComment({
    agentState: 'pending',
    authorType: 'agent',
    authorUserId: null,
    body: '',
    threadId: thread.id,
  })

  const client = input.client ?? createConfiguredClient()

  try {
    await ensurePullRequestReviewAgentSession({
      client,
      requestedByUserId: input.requestedByUserId,
      snapshotId: thread.anchorSnapshotId,
    })
  } catch (error) {
    await failPendingAgentComments(thread.id, describeTurnError(error))
    throw error
  }

  return advancePullRequestReviewAgentReply({
    client,
    threadId: thread.id,
  })
}

/**
 * One step of the agent turn state machine, safe to call repeatedly:
 * - daemon session failed or lost mid-turn -> pending comment becomes error;
 * - session idle and an unsent question exists -> claim it (optimistic,
 *   cross-instance safe) and send the question;
 * - session idle after our question's seq -> extract the assistant reply and
 *   complete the comment;
 * - otherwise the turn is still running and nothing changes.
 */
export async function advancePullRequestReviewAgentReply(input: {
  client?: ReviewAgentReplyClient
  threadId: string
}): Promise<ReviewAgentReplyResult> {
  const thread = await getReviewThread(input.threadId)

  if (!thread) {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'Review thread was not found.',
      404,
    )
  }

  const pending = thread.comments.filter(isPendingAgentComment)

  if (pending.length === 0) {
    return { thread }
  }

  const session = await getReviewAgentSessionForPullRequest({
    owner: thread.owner,
    pullRequestNumber: thread.pullRequestNumber,
    repo: thread.repo,
  })

  if (!session) {
    await failPendingAgentComments(
      thread.id,
      'No agent session exists for this pull request. Ask the agent again.',
    )
    return refreshedThread(thread.id)
  }

  const client = input.client ?? createConfiguredClient()
  let snapshot: AgentsDaemonExecutionSessionSnapshot

  try {
    snapshot = await client.getExecutionSession(session.daemonSessionId)
  } catch (error) {
    if (isMissingSessionError(error)) {
      // The daemon restarted. Unsent questions can recover via a fresh
      // ensure on the next start; a question that was mid-turn is gone.
      await failPendingAgentComments(
        thread.id,
        'The agent session was lost (daemon restart). Ask the agent again.',
      )
      return refreshedThread(thread.id)
    }

    throw toReplyError(error)
  }

  if (snapshot.status === 'failed') {
    await failPendingAgentComments(
      thread.id,
      'The agent session failed while answering. Ask the agent again.',
    )
    await persistSessionSnapshot(session.id, snapshot)
    return refreshedThread(thread.id)
  }

  const oldest = pending[0]

  if (oldest.agentSeqStart === null) {
    if (isIdle(snapshot)) {
      await claimAndSendQuestion({ client, snapshot, thread, oldest })
    }
    return refreshedThread(thread.id)
  }

  if (isIdle(snapshot) && snapshot.lastSeq > oldest.agentSeqStart) {
    const replyText = extractAgentReplyAfterLastUserMessage(
      parseAgentsDaemonConversationItems(snapshot.conversation),
    )

    await updateReviewThreadComment({
      agentState: 'complete',
      body:
        replyText ??
        'The agent finished the turn without a text reply. Check the daemon session for details.',
      commentId: oldest.id,
    })
    await persistSessionSnapshot(session.id, snapshot)
  }

  return refreshedThread(thread.id)
}

async function claimAndSendQuestion(params: {
  client: ReviewAgentReplyClient
  oldest: ReviewThreadCommentRow
  snapshot: AgentsDaemonExecutionSessionSnapshot
  thread: ReviewThreadWithComments
}): Promise<void> {
  const { client, oldest, snapshot, thread } = params
  const claimed = await claimReviewThreadAgentTurn({
    agentSeqStart: snapshot.lastSeq,
    commentId: oldest.id,
  })

  if (!claimed) {
    return
  }

  const question = latestReviewerQuestion(thread)

  try {
    await client.sendExecutionSessionMessage({
      sessionId: snapshot.sessionId,
      text: buildReviewThreadAgentQuestionPrompt({
        anchor: thread,
        history: thread.comments
          .filter((comment) => comment.body.trim() && comment.body !== question)
          .map((comment) => ({
            authorType: comment.authorType,
            body: comment.body,
          })),
        question: question ?? '',
      }),
    })
  } catch (error) {
    await updateReviewThreadComment({
      agentState: 'error',
      body: describeTurnError(error),
      commentId: oldest.id,
    })
    throw toReplyError(error)
  }
}

async function persistSessionSnapshot(
  sessionRowId: string,
  snapshot: AgentsDaemonExecutionSessionSnapshot,
): Promise<void> {
  await updateReviewAgentSessionFromSnapshot({
    continuationToken: snapshot.continuationToken,
    id: sessionRowId,
    lastSeq: snapshot.lastSeq,
    prUrl: snapshot.prUrl,
    status: snapshot.status,
    workspace: snapshot.workspace,
  })
}

async function failPendingAgentComments(
  threadId: string,
  message: string,
): Promise<void> {
  const thread = await getReviewThread(threadId)

  for (const comment of thread?.comments.filter(isPendingAgentComment) ?? []) {
    await updateReviewThreadComment({
      agentState: 'error',
      body: message,
      commentId: comment.id,
    })
  }
}

async function refreshedThread(
  threadId: string,
): Promise<ReviewAgentReplyResult> {
  const thread = await getReviewThread(threadId)

  if (!thread) {
    throw new PullRequestReviewAgentSessionError(
      'unexpected',
      'The review thread disappeared while the agent was answering.',
      500,
    )
  }

  return { thread }
}

function isPendingAgentComment(comment: ReviewThreadCommentRow): boolean {
  return comment.authorType === 'agent' && comment.agentState === 'pending'
}

function isIdle(snapshot: AgentsDaemonExecutionSessionSnapshot): boolean {
  return snapshot.status === 'idle' || snapshot.status === 'completed'
}

function latestReviewerQuestion(
  thread: ReviewThreadWithComments,
): string | null {
  for (let index = thread.comments.length - 1; index >= 0; index -= 1) {
    const comment = thread.comments[index]

    if (comment.authorType === 'user' && comment.body.trim()) {
      return comment.body.trim()
    }
  }

  return null
}

function isMissingSessionError(error: unknown): boolean {
  return (
    error instanceof AgentsDaemonClientError &&
    error.code === 'daemon-error' &&
    error.details.status === 404
  )
}

function describeTurnError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The review agent failed to answer.'
}

function toReplyError(error: unknown): PullRequestReviewAgentSessionError {
  if (error instanceof PullRequestReviewAgentSessionError) {
    return error
  }

  if (error instanceof AgentsDaemonClientError) {
    return new PullRequestReviewAgentSessionError(
      'daemon',
      error.message,
      error.details.status ?? 502,
      error,
    )
  }

  return new PullRequestReviewAgentSessionError(
    'unexpected',
    describeTurnError(error),
    500,
    error,
  )
}

function createConfiguredClient(): AgentsDaemonClient {
  const config = getAgentsDaemonConfig()

  if (!config.ok) {
    throw new PullRequestReviewAgentSessionError(
      'configuration',
      config.message,
      503,
    )
  }

  return new AgentsDaemonClient(config.config)
}
