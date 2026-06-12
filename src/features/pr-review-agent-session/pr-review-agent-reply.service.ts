import 'server-only'

import {
  AgentsDaemonClient,
  getAgentsDaemonConfig,
  parseAgentsDaemonConversationItems,
  type AgentsDaemonExecutionSessionSnapshot,
} from '@/entities/agents-daemon'
import {
  addReviewThreadComment,
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
  buildReviewAgentTurnQueueKey,
  buildReviewThreadAgentQuestionPrompt,
  extractAgentReplyText,
} from './pr-review-agent-session.pure'

export type AskPullRequestReviewAgentInput = {
  client?: Pick<
    AgentsDaemonClient,
    | 'getExecutionSession'
    | 'sendExecutionSessionMessage'
    | 'startExecutionSession'
  >
  pollIntervalMs?: number
  requestedByUserId: string | null
  threadId: string
  timeoutMs?: number
  sleep?: (ms: number) => Promise<void>
}

export type AskPullRequestReviewAgentResult = {
  agentComment: ReviewThreadCommentRow
  thread: ReviewThreadWithComments
}

const DEFAULT_POLL_INTERVAL_MS = 2_000
const DEFAULT_TURN_TIMEOUT_MS = 240_000

/**
 * Serializes agent turns per pull request: the daemon session runs one
 * provider turn at a time, so concurrent questions queue in arrival order.
 * In-memory only — cross-instance locking is P8's concern.
 */
const reviewAgentTurnQueues = new Map<string, Promise<unknown>>()

function enqueueReviewAgentTurn<T>(
  key: string,
  task: () => Promise<T>,
): Promise<T> {
  const tail = reviewAgentTurnQueues.get(key) ?? Promise.resolve()
  const next = tail.then(task, task)
  reviewAgentTurnQueues.set(
    key,
    next.catch(() => undefined),
  )
  return next
}

/**
 * Answers the latest reviewer question in a thread with the per-PR daemon
 * agent: creates a pending agent comment, waits for the session to go idle,
 * records the conversation baseline, sends the anchored question, polls the
 * turn to completion, and fills the comment with the assistant reply.
 */
export async function askPullRequestReviewAgent(
  input: AskPullRequestReviewAgentInput,
): Promise<AskPullRequestReviewAgentResult> {
  const thread = await getReviewThread(input.threadId)

  if (!thread) {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'Review thread was not found.',
      404,
    )
  }

  const question = latestReviewerQuestion(thread)

  if (!question) {
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

  const agentComment = await addReviewThreadComment({
    agentState: 'pending',
    authorType: 'agent',
    authorUserId: null,
    body: '',
    threadId: thread.id,
  })

  try {
    await enqueueReviewAgentTurn(buildReviewAgentTurnQueueKey(thread), () =>
      runReviewAgentTurn({ agentCommentId: agentComment.id, input, thread }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'The review agent failed to answer.'
    await updateReviewThreadComment({
      agentState: 'error',
      body: message,
      commentId: agentComment.id,
    })
    throw error
  }

  const updatedThread = await getReviewThread(thread.id)
  const updatedComment = updatedThread?.comments.find(
    (comment) => comment.id === agentComment.id,
  )

  if (!updatedThread || !updatedComment) {
    throw new PullRequestReviewAgentSessionError(
      'unexpected',
      'The review thread disappeared while the agent was answering.',
      500,
    )
  }

  return { agentComment: updatedComment, thread: updatedThread }
}

async function runReviewAgentTurn(params: {
  agentCommentId: string
  input: AskPullRequestReviewAgentInput
  thread: ReviewThreadWithComments
}): Promise<void> {
  const { agentCommentId, input, thread } = params
  const client = input.client ?? createConfiguredClient()
  const sleep = input.sleep ?? defaultSleep
  const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const timeoutMs = input.timeoutMs ?? DEFAULT_TURN_TIMEOUT_MS

  const ensured = await ensurePullRequestReviewAgentSession({
    client,
    requestedByUserId: input.requestedByUserId,
    snapshotId: thread.anchorSnapshotId as string,
  })

  const idle = await waitForExecutionSessionTurnEnd({
    client,
    minConversationLength: 0,
    pollIntervalMs,
    sessionId: ensured.daemonSnapshot.sessionId,
    sleep,
    snapshot: ensured.daemonSnapshot,
    timeoutMs,
  })

  const baseline = idle.conversation.length

  await updateReviewThreadComment({
    agentSeqStart: idle.lastSeq,
    commentId: agentCommentId,
  })

  await client.sendExecutionSessionMessage({
    sessionId: idle.sessionId,
    text: buildReviewThreadAgentQuestionPrompt({
      anchor: thread,
      history: thread.comments
        .slice(0, -1)
        .filter((comment) => comment.body.trim())
        .map((comment) => ({
          authorType: comment.authorType,
          body: comment.body,
        })),
      question: latestReviewerQuestion(thread) ?? '',
    }),
  })

  const finished = await waitForExecutionSessionTurnEnd({
    client,
    minConversationLength: baseline + 1,
    pollIntervalMs,
    sessionId: idle.sessionId,
    sleep,
    snapshot: null,
    timeoutMs,
  })

  const replyText = extractAgentReplyText(
    parseAgentsDaemonConversationItems(finished.conversation),
    baseline,
  )

  await updateReviewThreadComment({
    agentState: 'complete',
    body:
      replyText ??
      'The agent finished the turn without a text reply. Check the daemon session for details.',
    commentId: agentCommentId,
  })

  await updateReviewAgentSessionFromSnapshot({
    continuationToken: finished.continuationToken,
    id: ensured.session.id,
    lastSeq: finished.lastSeq,
    prUrl: finished.prUrl,
    status: finished.status,
    workspace: finished.workspace,
  })
}

async function waitForExecutionSessionTurnEnd(params: {
  client: Pick<AgentsDaemonClient, 'getExecutionSession'>
  minConversationLength: number
  pollIntervalMs: number
  sessionId: string
  sleep: (ms: number) => Promise<void>
  snapshot: AgentsDaemonExecutionSessionSnapshot | null
  timeoutMs: number
}): Promise<AgentsDaemonExecutionSessionSnapshot> {
  const startedAt = Date.now()
  let snapshot = params.snapshot

  for (;;) {
    if (snapshot && isExecutionTurnSettled(snapshot, params)) {
      return snapshot
    }

    if (Date.now() - startedAt > params.timeoutMs) {
      throw new PullRequestReviewAgentSessionError(
        'daemon',
        'Timed out waiting for the review agent to finish its turn.',
        504,
      )
    }

    if (snapshot) {
      await params.sleep(params.pollIntervalMs)
    }

    snapshot = await params.client.getExecutionSession(params.sessionId)

    if (snapshot.status === 'failed') {
      throw new PullRequestReviewAgentSessionError(
        'daemon',
        'The review agent session failed while answering.',
        502,
      )
    }
  }
}

function isExecutionTurnSettled(
  snapshot: AgentsDaemonExecutionSessionSnapshot,
  params: { minConversationLength: number },
): boolean {
  return (
    (snapshot.status === 'idle' || snapshot.status === 'completed') &&
    snapshot.conversation.length >= params.minConversationLength
  )
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

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
