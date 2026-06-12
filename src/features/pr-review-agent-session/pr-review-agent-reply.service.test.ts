import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentsDaemonClientError } from '@/entities/agents-daemon'
import {
  addReviewThreadComment,
  claimReviewThreadAgentTurn,
  getReviewAgentSessionForPullRequest,
  getReviewThread,
  updateReviewAgentSessionFromSnapshot,
  updateReviewThreadComment,
} from '@/entities/database'
import { ensurePullRequestReviewAgentSession } from './pr-review-agent-session.service'
import {
  advancePullRequestReviewAgentReply,
  startPullRequestReviewAgentReply,
} from './pr-review-agent-reply.service'

vi.mock('server-only', () => ({}))

vi.mock('@/entities/database', async () => {
  const actual = await vi.importActual<typeof import('@/entities/database')>(
    '@/entities/database',
  )

  return {
    ...actual,
    addReviewThreadComment: vi.fn(),
    claimReviewThreadAgentTurn: vi.fn(),
    getReviewAgentSessionForPullRequest: vi.fn(),
    getReviewThread: vi.fn(),
    updateReviewAgentSessionFromSnapshot: vi.fn(),
    updateReviewThreadComment: vi.fn(),
  }
})

vi.mock('./pr-review-agent-session.service', async () => {
  const actual = await vi.importActual<
    typeof import('./pr-review-agent-session.service')
  >('./pr-review-agent-session.service')

  return {
    ...actual,
    ensurePullRequestReviewAgentSession: vi.fn(),
  }
})

const mockedGetReviewThread = vi.mocked(getReviewThread)
const mockedAddReviewThreadComment = vi.mocked(addReviewThreadComment)
const mockedClaimReviewThreadAgentTurn = vi.mocked(claimReviewThreadAgentTurn)
const mockedGetSession = vi.mocked(getReviewAgentSessionForPullRequest)
const mockedUpdateReviewThreadComment = vi.mocked(updateReviewThreadComment)
const mockedUpdateSessionFromSnapshot = vi.mocked(
  updateReviewAgentSessionFromSnapshot,
)
const mockedEnsureSession = vi.mocked(ensurePullRequestReviewAgentSession)

const questionComment = {
  id: 'comment-1',
  threadId: 'thread-1',
  authorType: 'user' as const,
  authorUserId: 'user-1',
  body: 'Why is this safe?',
  agentState: null,
  agentSeqStart: null,
  createdAt: new Date('2026-06-12T10:00:00Z'),
}

const pendingUnsent = {
  id: 'comment-2',
  threadId: 'thread-1',
  authorType: 'agent' as const,
  authorUserId: null,
  body: '',
  agentState: 'pending' as const,
  agentSeqStart: null as number | null,
  createdAt: new Date('2026-06-12T10:00:05Z'),
}

const pendingSent = { ...pendingUnsent, agentSeqStart: 3 }

function makeThread(
  comments: Array<typeof questionComment | typeof pendingUnsent>,
) {
  return {
    id: 'thread-1',
    owner: 'ef-global',
    repo: 'backpack',
    pullRequestNumber: 42,
    anchorSnapshotId: 'snapshot-1',
    anchorCommitSha: 'abc123',
    filePath: 'src/auth.ts',
    side: 'new' as const,
    lineStart: 10,
    lineEnd: 14,
    excerpt: 'const token = parse(header)',
    status: 'open' as const,
    createdByUserId: 'user-1',
    createdAt: new Date('2026-06-12T10:00:00Z'),
    updatedAt: new Date('2026-06-12T10:00:00Z'),
    comments,
  }
}

const sessionRow = {
  daemonSessionId: 'daemon-1',
  id: 'session-row-1',
} as never

function daemonSnapshot(input: {
  conversation?: unknown[]
  lastSeq?: number
  status?: 'idle' | 'running' | 'completed' | 'failed'
}) {
  return {
    activity: null,
    attention: 'none',
    contextWindow: null,
    continuationToken: 'cont-1',
    conversation: input.conversation ?? [],
    lastSeq: input.lastSeq ?? 3,
    prUrl: null,
    protocolVersion: 1 as const,
    providerId: 'codex',
    sessionId: 'daemon-1',
    status: input.status ?? 'idle',
    workspace: null,
  }
}

const answeredConversation = [
  {
    actor: 'user',
    id: 'i-1',
    kind: 'message',
    state: 'complete',
    text: 'boot',
  },
  {
    actor: 'assistant',
    id: 'i-2',
    kind: 'message',
    state: 'complete',
    text: 'Ready.',
  },
  {
    actor: 'user',
    id: 'i-3',
    kind: 'message',
    state: 'complete',
    text: 'question',
  },
  {
    actor: 'assistant',
    id: 'i-4',
    kind: 'message',
    state: 'complete',
    text: 'It validates the token before use.',
  },
]

function makeClient(snapshots: ReturnType<typeof daemonSnapshot>[]) {
  const getExecutionSession = vi.fn()
  for (const snapshot of snapshots) {
    getExecutionSession.mockResolvedValueOnce(snapshot)
  }

  return {
    getExecutionSession,
    sendExecutionSessionMessage: vi.fn().mockResolvedValue({ accepted: true }),
    startExecutionSession: vi.fn(),
  }
}

describe('review agent reply state machine', () => {
  beforeEach(() => {
    mockedAddReviewThreadComment.mockResolvedValue(pendingUnsent)
    mockedClaimReviewThreadAgentTurn.mockResolvedValue(pendingSent)
    mockedGetSession.mockResolvedValue(sessionRow)
    mockedUpdateReviewThreadComment.mockResolvedValue(pendingSent)
    mockedUpdateSessionFromSnapshot.mockResolvedValue({} as never)
    mockedEnsureSession.mockResolvedValue({
      action: 'reused',
      daemonSnapshot: daemonSnapshot({}),
      session: sessionRow,
    } as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('start creates the pending comment and sends the question when idle', async () => {
    mockedGetReviewThread
      .mockResolvedValueOnce(makeThread([questionComment]))
      .mockResolvedValue(makeThread([questionComment, pendingUnsent]))
    const client = makeClient([daemonSnapshot({ status: 'idle' })])

    await startPullRequestReviewAgentReply({
      client,
      requestedByUserId: 'user-1',
      threadId: 'thread-1',
    })

    expect(mockedAddReviewThreadComment).toHaveBeenCalledWith(
      expect.objectContaining({ agentState: 'pending', authorType: 'agent' }),
    )
    expect(mockedEnsureSession).toHaveBeenCalled()
    expect(mockedClaimReviewThreadAgentTurn).toHaveBeenCalledWith({
      agentSeqStart: 3,
      commentId: 'comment-2',
    })
    const sent = client.sendExecutionSessionMessage.mock.calls[0]?.[0]
    expect(sent.sessionId).toBe('daemon-1')
    expect(sent.text).toContain('Question: Why is this safe?')
    expect(sent.text).toContain('File: src/auth.ts')
  })

  it('start does not stack a second pending comment', async () => {
    mockedGetReviewThread.mockResolvedValue(
      makeThread([questionComment, pendingUnsent]),
    )

    await startPullRequestReviewAgentReply({
      client: makeClient([]),
      requestedByUserId: 'user-1',
      threadId: 'thread-1',
    })

    expect(mockedAddReviewThreadComment).not.toHaveBeenCalled()
    expect(mockedEnsureSession).not.toHaveBeenCalled()
  })

  it('advance waits silently while the session is running', async () => {
    mockedGetReviewThread.mockResolvedValue(
      makeThread([questionComment, pendingUnsent]),
    )
    const client = makeClient([daemonSnapshot({ status: 'running' })])

    await advancePullRequestReviewAgentReply({ client, threadId: 'thread-1' })

    expect(mockedClaimReviewThreadAgentTurn).not.toHaveBeenCalled()
    expect(client.sendExecutionSessionMessage).not.toHaveBeenCalled()
    expect(mockedUpdateReviewThreadComment).not.toHaveBeenCalled()
  })

  it('advance sends an unsent question once the session is idle', async () => {
    mockedGetReviewThread.mockResolvedValue(
      makeThread([questionComment, pendingUnsent]),
    )
    const client = makeClient([daemonSnapshot({ status: 'idle' })])

    await advancePullRequestReviewAgentReply({ client, threadId: 'thread-1' })

    expect(mockedClaimReviewThreadAgentTurn).toHaveBeenCalled()
    expect(client.sendExecutionSessionMessage).toHaveBeenCalledTimes(1)
  })

  it('advance does not send when the optimistic claim is lost', async () => {
    mockedClaimReviewThreadAgentTurn.mockResolvedValue(null)
    mockedGetReviewThread.mockResolvedValue(
      makeThread([questionComment, pendingUnsent]),
    )
    const client = makeClient([daemonSnapshot({ status: 'idle' })])

    await advancePullRequestReviewAgentReply({ client, threadId: 'thread-1' })

    expect(client.sendExecutionSessionMessage).not.toHaveBeenCalled()
  })

  it('advance completes a sent question after the turn ended', async () => {
    mockedGetReviewThread.mockResolvedValue(
      makeThread([questionComment, pendingSent]),
    )
    const client = makeClient([
      daemonSnapshot({
        conversation: answeredConversation,
        lastSeq: 9,
        status: 'idle',
      }),
    ])

    await advancePullRequestReviewAgentReply({ client, threadId: 'thread-1' })

    expect(mockedUpdateReviewThreadComment).toHaveBeenCalledWith({
      agentState: 'complete',
      body: 'It validates the token before use.',
      commentId: 'comment-2',
    })
    expect(mockedUpdateSessionFromSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-row-1', lastSeq: 9 }),
    )
  })

  it('advance keeps waiting when the seq has not moved past the claim', async () => {
    mockedGetReviewThread.mockResolvedValue(
      makeThread([questionComment, pendingSent]),
    )
    const client = makeClient([daemonSnapshot({ lastSeq: 3, status: 'idle' })])

    await advancePullRequestReviewAgentReply({ client, threadId: 'thread-1' })

    expect(mockedUpdateReviewThreadComment).not.toHaveBeenCalled()
  })

  it('advance errors pending comments when the daemon session failed', async () => {
    mockedGetReviewThread.mockResolvedValue(
      makeThread([questionComment, pendingSent]),
    )
    const client = makeClient([daemonSnapshot({ status: 'failed' })])

    await advancePullRequestReviewAgentReply({ client, threadId: 'thread-1' })

    expect(mockedUpdateReviewThreadComment).toHaveBeenCalledWith(
      expect.objectContaining({ agentState: 'error', commentId: 'comment-2' }),
    )
  })

  it('advance errors pending comments when the daemon session is gone', async () => {
    mockedGetReviewThread.mockResolvedValue(
      makeThread([questionComment, pendingSent]),
    )
    const client = {
      getExecutionSession: vi.fn().mockRejectedValue(
        new AgentsDaemonClientError('daemon-error', 'Session not found', {
          status: 404,
        }),
      ),
      sendExecutionSessionMessage: vi.fn(),
      startExecutionSession: vi.fn(),
    }

    await advancePullRequestReviewAgentReply({ client, threadId: 'thread-1' })

    expect(mockedUpdateReviewThreadComment).toHaveBeenCalledWith(
      expect.objectContaining({ agentState: 'error', commentId: 'comment-2' }),
    )
  })
})
