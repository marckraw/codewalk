import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addReviewThreadComment,
  getReviewThread,
  updateReviewAgentSessionFromSnapshot,
  updateReviewThreadComment,
} from '@/entities/database'
import { ensurePullRequestReviewAgentSession } from './pr-review-agent-session.service'
import { askPullRequestReviewAgent } from './pr-review-agent-reply.service'

vi.mock('server-only', () => ({}))

vi.mock('@/entities/database', async () => {
  const actual = await vi.importActual<typeof import('@/entities/database')>(
    '@/entities/database',
  )

  return {
    ...actual,
    addReviewThreadComment: vi.fn(),
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
const mockedUpdateReviewThreadComment = vi.mocked(updateReviewThreadComment)
const mockedUpdateSessionFromSnapshot = vi.mocked(
  updateReviewAgentSessionFromSnapshot,
)
const mockedEnsureSession = vi.mocked(ensurePullRequestReviewAgentSession)

const thread = {
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
  comments: [
    {
      id: 'comment-1',
      threadId: 'thread-1',
      authorType: 'user' as const,
      authorUserId: 'user-1',
      body: 'Why is this safe?',
      agentState: null,
      agentSeqStart: null,
      createdAt: new Date('2026-06-12T10:00:00Z'),
    },
  ],
}

const agentComment = {
  id: 'comment-2',
  threadId: 'thread-1',
  authorType: 'agent' as const,
  authorUserId: null,
  body: '',
  agentState: 'pending' as const,
  agentSeqStart: null,
  createdAt: new Date('2026-06-12T10:00:05Z'),
}

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
    workspace: {
      baseRef: 'main',
      branchName: 'agent/codewalk',
      repository: 'https://github.com/ef-global/backpack',
    },
  }
}

const bootConversation = [
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
]

const answeredConversation = [
  ...bootConversation,
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

const threadWithAgentReply = {
  ...thread,
  comments: [
    ...thread.comments,
    {
      ...agentComment,
      agentState: 'complete' as const,
      body: 'It validates the token before use.',
    },
  ],
}

describe('askPullRequestReviewAgent', () => {
  beforeEach(() => {
    mockedGetReviewThread.mockImplementation(async (threadId) =>
      threadId === 'thread-1' ? threadWithAgentReply : null,
    )
    mockedAddReviewThreadComment.mockResolvedValue(agentComment)
    mockedUpdateReviewThreadComment.mockImplementation(async (input) => ({
      ...agentComment,
      agentSeqStart: input.agentSeqStart ?? agentComment.agentSeqStart,
      agentState: input.agentState ?? agentComment.agentState,
      body: input.body ?? agentComment.body,
    }))
    mockedUpdateSessionFromSnapshot.mockResolvedValue({} as never)
    mockedEnsureSession.mockResolvedValue({
      action: 'reused',
      daemonSnapshot: daemonSnapshot({ conversation: bootConversation }),
      session: { id: 'session-row-1' } as never,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('answers the thread question with the assistant reply from the turn', async () => {
    const client = {
      getExecutionSession: vi
        .fn()
        .mockResolvedValueOnce(
          daemonSnapshot({ conversation: bootConversation }),
        )
        .mockResolvedValueOnce(
          daemonSnapshot({
            conversation: answeredConversation,
            lastSeq: 9,
          }),
        ),
      sendExecutionSessionMessage: vi.fn().mockResolvedValue({
        accepted: true,
      }),
      startExecutionSession: vi.fn(),
    }
    mockedGetReviewThread
      .mockResolvedValueOnce(thread)
      .mockResolvedValueOnce(threadWithAgentReply)

    const result = await askPullRequestReviewAgent({
      client,
      requestedByUserId: 'user-1',
      sleep: async () => {},
      threadId: 'thread-1',
    })

    expect(result.agentComment).toMatchObject({
      agentState: 'complete',
      body: 'It validates the token before use.',
    })

    const sentText = client.sendExecutionSessionMessage.mock.calls[0]?.[0]?.text
    expect(sentText).toContain('File: src/auth.ts')
    expect(sentText).toContain('Question: Why is this safe?')

    expect(mockedUpdateReviewThreadComment).toHaveBeenCalledWith(
      expect.objectContaining({ agentSeqStart: 3, commentId: 'comment-2' }),
    )
    expect(mockedUpdateReviewThreadComment).toHaveBeenCalledWith(
      expect.objectContaining({
        agentState: 'complete',
        body: 'It validates the token before use.',
        commentId: 'comment-2',
      }),
    )
    expect(mockedUpdateSessionFromSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-row-1', lastSeq: 9 }),
    )
  })

  it('waits for a running boot turn before sending the question', async () => {
    const client = {
      getExecutionSession: vi
        .fn()
        .mockResolvedValueOnce(daemonSnapshot({ status: 'running' }))
        .mockResolvedValueOnce(
          daemonSnapshot({ conversation: bootConversation }),
        )
        .mockResolvedValueOnce(
          daemonSnapshot({ conversation: answeredConversation }),
        ),
      sendExecutionSessionMessage: vi.fn().mockResolvedValue({
        accepted: true,
      }),
      startExecutionSession: vi.fn(),
    }
    mockedEnsureSession.mockResolvedValue({
      action: 'created',
      daemonSnapshot: daemonSnapshot({ status: 'running' }),
      session: { id: 'session-row-1' } as never,
    })

    await askPullRequestReviewAgent({
      client,
      requestedByUserId: 'user-1',
      sleep: async () => {},
      threadId: 'thread-1',
    })

    expect(client.getExecutionSession).toHaveBeenCalledTimes(3)
    expect(client.sendExecutionSessionMessage).toHaveBeenCalledTimes(1)
  })

  it('marks the agent comment as errored when the daemon turn fails', async () => {
    const client = {
      getExecutionSession: vi
        .fn()
        .mockResolvedValueOnce(
          daemonSnapshot({ conversation: bootConversation }),
        )
        .mockResolvedValueOnce(daemonSnapshot({ status: 'failed' })),
      sendExecutionSessionMessage: vi.fn().mockResolvedValue({
        accepted: true,
      }),
      startExecutionSession: vi.fn(),
    }

    await expect(
      askPullRequestReviewAgent({
        client,
        requestedByUserId: 'user-1',
        sleep: async () => {},
        threadId: 'thread-1',
      }),
    ).rejects.toThrow('failed while answering')

    expect(mockedUpdateReviewThreadComment).toHaveBeenCalledWith(
      expect.objectContaining({
        agentState: 'error',
        commentId: 'comment-2',
      }),
    )
  })

  it('rejects threads without an anchored snapshot', async () => {
    mockedGetReviewThread.mockResolvedValue({
      ...thread,
      anchorSnapshotId: null,
    })

    await expect(
      askPullRequestReviewAgent({
        requestedByUserId: 'user-1',
        threadId: 'thread-1',
      }),
    ).rejects.toThrow('not linked to an imported pull request snapshot')

    expect(mockedAddReviewThreadComment).not.toHaveBeenCalled()
  })

  it('queues a second question until the first turn completes', async () => {
    let resolveFirstTurn: (() => void) | undefined
    const firstTurnGate = new Promise<void>((resolve) => {
      resolveFirstTurn = resolve
    })
    const order: string[] = []

    const client = {
      getExecutionSession: vi.fn().mockImplementation(async () => {
        return daemonSnapshot({ conversation: answeredConversation })
      }),
      sendExecutionSessionMessage: vi
        .fn()
        .mockImplementationOnce(async () => {
          order.push('first-send')
          await firstTurnGate
          return { accepted: true }
        })
        .mockImplementationOnce(async () => {
          order.push('second-send')
          return { accepted: true }
        }),
      startExecutionSession: vi.fn(),
    }

    const first = askPullRequestReviewAgent({
      client,
      requestedByUserId: 'user-1',
      sleep: async () => {},
      threadId: 'thread-1',
    })
    const second = askPullRequestReviewAgent({
      client,
      requestedByUserId: 'user-1',
      sleep: async () => {},
      threadId: 'thread-1',
    })

    await vi.waitFor(() => {
      expect(order).toContain('first-send')
    })
    expect(order).not.toContain('second-send')

    resolveFirstTurn?.()
    await Promise.all([first, second])

    expect(order).toEqual(['first-send', 'second-send'])
  })
})
