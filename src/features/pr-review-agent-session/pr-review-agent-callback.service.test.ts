import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getReviewAgentSessionByDaemonSessionId,
  listReviewThreadsForPullRequest,
} from '@/entities/database'
import { reconcileReviewAgentSessionCallback } from './pr-review-agent-callback.service'
import { advancePullRequestReviewAgentReply } from './pr-review-agent-reply.service'

vi.mock('server-only', () => ({}))

vi.mock('@/entities/database', () => ({
  getReviewAgentSessionByDaemonSessionId: vi.fn(),
  listReviewThreadsForPullRequest: vi.fn(),
}))

vi.mock('./pr-review-agent-reply.service', () => ({
  advancePullRequestReviewAgentReply: vi.fn(),
}))

const mockedGetSession = vi.mocked(getReviewAgentSessionByDaemonSessionId)
const mockedListThreads = vi.mocked(listReviewThreadsForPullRequest)
const mockedAdvance = vi.mocked(advancePullRequestReviewAgentReply)

describe('reconcileReviewAgentSessionCallback', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('advances only threads with an in-flight agent comment', async () => {
    mockedGetSession.mockResolvedValue({
      owner: 'acme',
      pullRequestNumber: 7,
      repo: 'app',
    } as never)
    mockedListThreads.mockResolvedValue([
      {
        id: 'thread-pending',
        comments: [{ authorType: 'agent', agentState: 'pending' }],
      },
      {
        id: 'thread-streaming',
        comments: [{ authorType: 'agent', agentState: 'streaming' }],
      },
      {
        id: 'thread-done',
        comments: [{ authorType: 'agent', agentState: 'complete' }],
      },
    ] as never)
    mockedAdvance.mockResolvedValue({} as never)

    await reconcileReviewAgentSessionCallback('daemon-1')

    expect(mockedAdvance).toHaveBeenCalledWith({ threadId: 'thread-pending' })
    expect(mockedAdvance).toHaveBeenCalledWith({ threadId: 'thread-streaming' })
    expect(mockedAdvance).not.toHaveBeenCalledWith({ threadId: 'thread-done' })
  })

  it('ignores an unknown session id', async () => {
    mockedGetSession.mockResolvedValue(null)

    await reconcileReviewAgentSessionCallback('daemon-unknown')

    expect(mockedListThreads).not.toHaveBeenCalled()
    expect(mockedAdvance).not.toHaveBeenCalled()
  })
})
