import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentsDaemonClientError } from '@/entities/agents-daemon'
import {
  getLatestPullRequestSnapshotByRef,
  getPullRequestSnapshotById,
  getReviewAgentSessionForPullRequest,
  startReviewAgentSession,
  updateReviewAgentSessionFromSnapshot,
  type PullRequestSnapshotRow,
  type ReviewAgentSessionRow,
} from '@/entities/database'
import {
  ensurePullRequestReviewAgentSession,
  getPullRequestReviewAgentSessionStatus,
} from './pr-review-agent-session.service'

vi.mock('server-only', () => ({}))

vi.mock('@/entities/database', async () => {
  const actual = await vi.importActual<typeof import('@/entities/database')>(
    '@/entities/database',
  )

  return {
    ...actual,
    getLatestPullRequestSnapshotByRef: vi.fn(),
    getPullRequestSnapshotById: vi.fn(),
    getReviewAgentSessionForPullRequest: vi.fn(),
    startReviewAgentSession: vi.fn(),
    updateReviewAgentSessionFromSnapshot: vi.fn(),
  }
})

const mockedGetPullRequestSnapshotById = vi.mocked(getPullRequestSnapshotById)
const mockedGetLatestSnapshotByRef = vi.mocked(
  getLatestPullRequestSnapshotByRef,
)
const mockedGetReviewAgentSessionForPullRequest = vi.mocked(
  getReviewAgentSessionForPullRequest,
)
const mockedStartReviewAgentSession = vi.mocked(startReviewAgentSession)
const mockedUpdateReviewAgentSessionFromSnapshot = vi.mocked(
  updateReviewAgentSessionFromSnapshot,
)

describe('ensurePullRequestReviewAgentSession', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AGENTS_DAEMON_API_TOKEN: 'token',
      AGENTS_DAEMON_BASE_URL: 'https://daemon.example.com',
      DEFAULT_GUIDE_MODEL: 'gpt-5.5',
      DEFAULT_GUIDE_PROVIDER: 'codex',
    }
    mockedGetPullRequestSnapshotById.mockResolvedValue(snapshot)
    mockedGetLatestSnapshotByRef.mockResolvedValue(snapshot)
    mockedGetReviewAgentSessionForPullRequest.mockResolvedValue(null)
    mockedStartReviewAgentSession.mockResolvedValue(storedSession)
    mockedUpdateReviewAgentSessionFromSnapshot.mockResolvedValue(updatedSession)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('creates a daemon execution session for a PR when none is stored', async () => {
    const client = {
      getExecutionSession: vi.fn().mockResolvedValue(daemonSnapshot),
      startExecutionSession: vi
        .fn()
        .mockResolvedValue({ protocolVersion: 1, sessionId: 'daemon-1' }),
    }

    await expect(
      ensurePullRequestReviewAgentSession({
        client,
        requestedByUserId: 'user-1',
        snapshotId: 'snapshot-1',
      }),
    ).resolves.toMatchObject({
      action: 'created',
      daemonSnapshot,
      session: updatedSession,
    })

    expect(client.startExecutionSession).toHaveBeenCalledWith(
      expect.objectContaining({
        continuationToken: null,
        metadata: {
          attributes: {
            snapshotId: 'snapshot-1',
          },
          source: {
            id: 'codewalk:ef-global/backpack/pull-42',
            kind: 'pull-request-review',
            surface: 'codewalk',
          },
          thread: {
            conversationId: 'ef-global/backpack/pull-42',
            id: 'ef-global/backpack/pull-42',
            url: 'https://github.com/ef-global/backpack/pull/42',
          },
          user: {
            id: 'user-1',
          },
          workspace: {
            attributes: {
              baseRef: 'main',
              headRef: 'feature',
            },
            id: 'ef-global/backpack',
            pullRequestNumber: 42,
            ref: 'head-sha',
            repository: 'https://github.com/ef-global/backpack',
          },
        },
        model: 'gpt-5.5',
        providerId: 'codex',
        workspace: {
          ref: 'head-sha',
          repository: 'https://github.com/ef-global/backpack',
        },
      }),
    )
    expect(mockedStartReviewAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        createdByUserId: 'user-1',
        daemonSessionId: 'daemon-1',
        owner: 'ef-global',
        pullRequestNumber: 42,
        repo: 'backpack',
        snapshotId: 'snapshot-1',
      }),
    )
  })

  it('reuses an existing daemon session when the snapshot endpoint finds it', async () => {
    mockedGetReviewAgentSessionForPullRequest.mockResolvedValue(storedSession)
    const client = {
      getExecutionSession: vi.fn().mockResolvedValue(daemonSnapshot),
      startExecutionSession: vi.fn(),
    }

    await expect(
      ensurePullRequestReviewAgentSession({
        client,
        requestedByUserId: 'user-1',
        snapshotId: 'snapshot-1',
      }),
    ).resolves.toMatchObject({
      action: 'reused',
      daemonSnapshot,
      session: updatedSession,
    })

    expect(client.startExecutionSession).not.toHaveBeenCalled()
    expect(mockedUpdateReviewAgentSessionFromSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        continuationToken: 'thread-1',
        id: 'stored-session-1',
        lastSeq: 4,
      }),
    )
  })

  it('recreates a missing daemon session with the stored continuation token', async () => {
    mockedGetReviewAgentSessionForPullRequest.mockResolvedValue({
      ...storedSession,
      continuationToken: 'thread-old',
    })
    const client = {
      getExecutionSession: vi
        .fn()
        .mockRejectedValueOnce(
          new AgentsDaemonClientError('daemon-error', 'Session not found', {
            status: 404,
          }),
        )
        .mockResolvedValueOnce(daemonSnapshot),
      startExecutionSession: vi
        .fn()
        .mockResolvedValue({ protocolVersion: 1, sessionId: 'daemon-2' }),
    }

    await expect(
      ensurePullRequestReviewAgentSession({
        client,
        requestedByUserId: 'user-1',
        snapshotId: 'snapshot-1',
      }),
    ).resolves.toMatchObject({
      action: 'recreated',
      session: updatedSession,
    })

    expect(client.startExecutionSession).toHaveBeenCalledWith(
      expect.objectContaining({
        continuationToken: 'thread-old',
      }),
    )
  })

  it('recreates a persisted daemon session that is no longer commandable', async () => {
    mockedGetReviewAgentSessionForPullRequest.mockResolvedValue({
      ...storedSession,
      continuationToken: 'thread-old',
    })
    const client = {
      getExecutionSession: vi
        .fn()
        .mockResolvedValueOnce({ ...daemonSnapshot, commandable: false })
        .mockResolvedValueOnce(daemonSnapshot),
      startExecutionSession: vi
        .fn()
        .mockResolvedValue({ protocolVersion: 1, sessionId: 'daemon-2' }),
    }

    await expect(
      ensurePullRequestReviewAgentSession({
        client,
        requestedByUserId: 'user-1',
        snapshotId: 'snapshot-1',
      }),
    ).resolves.toMatchObject({
      action: 'recreated',
      session: updatedSession,
    })

    expect(client.startExecutionSession).toHaveBeenCalledWith(
      expect.objectContaining({
        continuationToken: 'thread-old',
      }),
    )
  })

  it('recreates the session at the latest head when the PR moved', async () => {
    mockedGetReviewAgentSessionForPullRequest.mockResolvedValue({
      ...storedSession,
      continuationToken: 'thread-old',
    })
    mockedGetLatestSnapshotByRef.mockResolvedValue({
      ...snapshot,
      headSha: 'head-sha-2',
      id: 'snapshot-2',
    } as PullRequestSnapshotRow)
    const client = {
      getExecutionSession: vi.fn().mockResolvedValue(daemonSnapshot),
      startExecutionSession: vi
        .fn()
        .mockResolvedValue({ protocolVersion: 1, sessionId: 'daemon-2' }),
    }

    await expect(
      ensurePullRequestReviewAgentSession({
        client,
        requestedByUserId: 'user-1',
        snapshotId: 'snapshot-1',
      }),
    ).resolves.toMatchObject({ action: 'recreated' })

    expect(client.startExecutionSession).toHaveBeenCalledWith(
      expect.objectContaining({
        continuationToken: 'thread-old',
        workspace: expect.objectContaining({ ref: 'head-sha-2' }),
      }),
    )
    expect(mockedStartReviewAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotId: 'snapshot-2' }),
    )
  })

  it('reports the live session activity without creating sessions', async () => {
    mockedGetReviewAgentSessionForPullRequest.mockResolvedValue(storedSession)
    const client = {
      getExecutionSession: vi.fn().mockResolvedValue({
        ...daemonSnapshot,
        activity: 'tool:Read',
        status: 'running' as const,
      }),
    }

    await expect(
      getPullRequestReviewAgentSessionStatus({
        client,
        owner: 'ef-global',
        pullRequestNumber: 42,
        repo: 'backpack',
      }),
    ).resolves.toEqual({ activity: 'tool:Read', state: 'running' })
  })

  it('reports none and lost states for missing sessions', async () => {
    mockedGetReviewAgentSessionForPullRequest.mockResolvedValue(null)

    await expect(
      getPullRequestReviewAgentSessionStatus({
        client: { getExecutionSession: vi.fn() },
        owner: 'ef-global',
        pullRequestNumber: 42,
        repo: 'backpack',
      }),
    ).resolves.toEqual({ activity: null, state: 'none' })

    mockedGetReviewAgentSessionForPullRequest.mockResolvedValue(storedSession)
    await expect(
      getPullRequestReviewAgentSessionStatus({
        client: {
          getExecutionSession: vi.fn().mockRejectedValue(
            new AgentsDaemonClientError('daemon-error', 'Session not found', {
              status: 404,
            }),
          ),
        },
        owner: 'ef-global',
        pullRequestNumber: 42,
        repo: 'backpack',
      }),
    ).resolves.toEqual({ activity: null, state: 'lost' })

    await expect(
      getPullRequestReviewAgentSessionStatus({
        client: {
          getExecutionSession: vi.fn().mockResolvedValue({
            ...daemonSnapshot,
            commandable: false,
          }),
        },
        owner: 'ef-global',
        pullRequestNumber: 42,
        repo: 'backpack',
      }),
    ).resolves.toEqual({ activity: null, state: 'lost' })
  })
})

const snapshot = {
  baseRef: 'main',
  headRef: 'feature',
  headSha: 'head-sha',
  id: 'snapshot-1',
  number: 42,
  owner: 'ef-global',
  repo: 'backpack',
  title: 'Improve review guide',
  url: 'https://github.com/ef-global/backpack/pull/42',
} as PullRequestSnapshotRow

const storedSession = {
  continuationToken: null,
  daemonSessionId: 'daemon-1',
  id: 'stored-session-1',
  owner: 'ef-global',
  pullRequestNumber: 42,
  repo: 'backpack',
  snapshotId: 'snapshot-1',
} as ReviewAgentSessionRow

const updatedSession = {
  ...storedSession,
  continuationToken: 'thread-1',
  lastSeq: 4,
  status: 'running',
  workspaceBranchName: 'agent/session-1',
} as ReviewAgentSessionRow

const daemonSnapshot = {
  activity: null,
  attention: 'none',
  commandable: true,
  contextWindow: null,
  continuationToken: 'thread-1',
  conversation: [],
  lastSeq: 4,
  prUrl: null,
  protocolVersion: 1 as const,
  providerId: 'codex',
  sessionId: 'daemon-1',
  status: 'running' as const,
  workspace: {
    baseRef: 'head-sha',
    branchName: 'agent/session-1',
    repository: 'https://github.com/ef-global/backpack',
  },
}
