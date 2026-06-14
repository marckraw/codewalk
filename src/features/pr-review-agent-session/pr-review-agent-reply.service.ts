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
  getLatestPullRequestSnapshotByRef,
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
  buildReviewThreadAgentFixPrompt,
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
 * Asks the agent to implement the change discussed in the thread. Records the
 * instruction as a reviewer comment, then a pending fix-proposal agent comment
 * driven by the same turn state machine as a question. When the turn completes
 * the proposal moves to `fixState: 'proposed'`, awaiting an explicit push.
 */
export async function startPullRequestReviewAgentFix(input: {
  client?: ReviewAgentReplyClient
  instruction?: string | null
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

  if (!thread.anchorSnapshotId) {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'The thread is not linked to an imported pull request snapshot.',
      409,
    )
  }

  if (thread.comments.some(isPendingAgentComment)) {
    return { thread }
  }

  const instruction =
    input.instruction?.trim() ||
    'Implement the fix we discussed in this thread.'

  await addReviewThreadComment({
    authorType: 'user',
    authorUserId: input.requestedByUserId,
    body: instruction,
    threadId: thread.id,
  })
  await addReviewThreadComment({
    agentState: 'pending',
    authorType: 'agent',
    authorUserId: null,
    body: '',
    commentKind: 'fix-proposal',
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
 * Publishes the commits the agent made for a proposed fix to the PR head
 * branch via the daemon, marks the proposal pushed, and records a system note
 * with the commit sha. A re-import of the PR then flags threads on the changed
 * lines outdated (P5).
 */
export async function approvePullRequestReviewAgentFix(input: {
  client?: Pick<AgentsDaemonClient, 'pushExecutionSessionWorkspace'>
  commentId: string
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

  const proposal = findProposedFix(thread, input.commentId)
  const session = await getReviewAgentSessionForPullRequest({
    owner: thread.owner,
    pullRequestNumber: thread.pullRequestNumber,
    repo: thread.repo,
  })

  if (!session) {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'No agent session exists for this pull request. Ask the agent to fix again.',
      409,
    )
  }

  const snapshot = await getLatestPullRequestSnapshotByRef({
    number: thread.pullRequestNumber,
    owner: thread.owner,
    repo: thread.repo,
  })

  if (!snapshot) {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'The pull request snapshot is missing. Re-import the pull request.',
      409,
    )
  }

  const client = input.client ?? createConfiguredClient()
  let result: Awaited<
    ReturnType<AgentsDaemonClient['pushExecutionSessionWorkspace']>
  >

  try {
    result = await client.pushExecutionSessionWorkspace({
      branch: snapshot.headRef,
      sessionId: session.daemonSessionId,
    })
  } catch (error) {
    throw toReplyError(error)
  }

  if (!result.pushed) {
    // No new commits to publish — most likely the session was recreated (head
    // moved or daemon restart) and the agent's local commit was lost. Leave the
    // proposal open so the reviewer can ask the agent to fix again.
    await addReviewThreadComment({
      authorType: 'agent',
      authorUserId: null,
      body: 'Nothing to push: the agent workspace had no new commits. The session may have been recreated — ask the agent to make the fix again, then approve.',
      commentKind: 'system',
      threadId: thread.id,
    })
    return refreshedThread(thread.id)
  }

  await updateReviewThreadComment({
    commentId: proposal.id,
    commitSha: result.commitSha,
    fixState: 'pushed',
  })
  await addReviewThreadComment({
    authorType: 'agent',
    authorUserId: null,
    body: `Pushed \`${result.commitSha}\` to \`${result.branch}\`.`,
    commentKind: 'system',
    commitSha: result.commitSha,
    threadId: thread.id,
  })

  return refreshedThread(thread.id)
}

/**
 * Discards a proposed fix: marks it discarded and best-effort asks the agent to
 * drop the commit it made, so the workspace matches the PR head for the next
 * fix. The revert is fire-and-forget — a failure must not block the discard.
 */
export async function discardPullRequestReviewAgentFix(input: {
  client?: Pick<AgentsDaemonClient, 'sendExecutionSessionMessage'>
  commentId: string
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

  const proposal = findProposedFix(thread, input.commentId)

  await updateReviewThreadComment({
    commentId: proposal.id,
    fixState: 'discarded',
  })

  const session = await getReviewAgentSessionForPullRequest({
    owner: thread.owner,
    pullRequestNumber: thread.pullRequestNumber,
    repo: thread.repo,
  })

  if (session) {
    try {
      const client = input.client ?? createConfiguredClient()
      await client.sendExecutionSessionMessage({
        sessionId: session.daemonSessionId,
        text: 'The reviewer discarded the change you proposed. Drop the commit you just made so the workspace matches the pull request head again (e.g. `git reset --hard HEAD~1` if it was a single commit). Do not make any new changes.',
      })
    } catch {
      // Best effort: the proposal is already marked discarded.
    }
  }

  await addReviewThreadComment({
    authorType: 'agent',
    authorUserId: null,
    body: 'Discarded the proposed fix.',
    commentKind: 'system',
    threadId: thread.id,
  })

  return refreshedThread(thread.id)
}

function findProposedFix(
  thread: ReviewThreadWithComments,
  commentId: string,
): ReviewThreadCommentRow {
  const proposal = thread.comments.find((comment) => comment.id === commentId)

  if (!proposal || proposal.commentKind !== 'fix-proposal') {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'No fix proposal was found for this comment.',
      404,
    )
  }

  if (proposal.fixState !== 'proposed') {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'This fix proposal is no longer awaiting a decision.',
      409,
    )
  }

  return proposal
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
      // A completed fix-proposal turn means the agent committed in its
      // workspace; the proposal now awaits an explicit push.
      ...(oldest.commentKind === 'fix-proposal'
        ? { fixState: 'proposed' as const }
        : {}),
    })
    await persistSessionSnapshot(session.id, snapshot)
    return refreshedThread(thread.id)
  }

  // Turn still running: stream the partial assistant text into the comment so
  // the reply appears progressively across polls instead of all at once on
  // completion. The daemon patches the assistant item per delta, so each
  // snapshot carries the text produced so far.
  if (!isIdle(snapshot)) {
    const partial = extractAgentReplyAfterLastUserMessage(
      parseAgentsDaemonConversationItems(snapshot.conversation),
    )
    if (partial && partial !== oldest.body) {
      await updateReviewThreadComment({
        agentState: 'streaming',
        body: partial,
        commentId: oldest.id,
      })
    }
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

  // The latest reviewer message is the question (for a normal turn) or the fix
  // instruction (for a fix-proposal turn — started by recording the
  // instruction as a reviewer comment). Either way it anchors the prompt.
  const latest = latestReviewerQuestion(thread)
  const history = thread.comments
    .filter(
      (comment) =>
        comment.body.trim() &&
        comment.body !== latest &&
        comment.commentKind !== 'system',
    )
    .map((comment) => ({
      authorType: comment.authorType,
      body: comment.body,
    }))

  try {
    await client.sendExecutionSessionMessage({
      sessionId: snapshot.sessionId,
      text:
        oldest.commentKind === 'fix-proposal'
          ? buildReviewThreadAgentFixPrompt({
              anchor: thread,
              history,
              instruction: latest ?? '',
            })
          : buildReviewThreadAgentQuestionPrompt({
              anchor: thread,
              history,
              question: latest ?? '',
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
  // "In flight" = not yet finalized: a freshly-queued turn ('pending') or one
  // whose partial reply is streaming in ('streaming'). Both keep the poll loop
  // running until the turn completes or errors.
  return (
    comment.authorType === 'agent' &&
    (comment.agentState === 'pending' || comment.agentState === 'streaming')
  )
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
