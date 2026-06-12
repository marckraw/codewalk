import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

vi.mock('@/entities/auth-server', () => ({
  getCurrentCodewalkUser: vi.fn(),
}))

vi.mock('@/entities/database', () => ({
  upsertAuthenticatedUser: vi.fn(),
}))

vi.mock('@/features/pr-review-agent-session', () => {
  class PullRequestReviewAgentSessionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status: number,
    ) {
      super(message)
    }
  }

  return {
    askPullRequestReviewAgent: vi.fn(),
    PullRequestReviewAgentSessionError,
  }
})

import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { upsertAuthenticatedUser } from '@/entities/database'
import {
  askPullRequestReviewAgent,
  PullRequestReviewAgentSessionError,
} from '@/features/pr-review-agent-session'

function postRequest() {
  return new Request(
    'http://localhost/api/review-threads/thread-1/agent-reply',
    { method: 'POST' },
  )
}

const context = {
  params: Promise.resolve({ threadId: 'thread-1' }),
}

describe('/api/review-threads/[threadId]/agent-reply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: 'reviewer@example.com',
      name: 'Reviewer',
      status: 'authenticated',
      userId: 'clerk-user-id',
    } as never)
    vi.mocked(upsertAuthenticatedUser).mockResolvedValue({
      id: 'db-user-1',
    } as never)
    vi.mocked(askPullRequestReviewAgent).mockResolvedValue({
      agentComment: { id: 'comment-2', agentState: 'complete' },
      thread: { id: 'thread-1' },
    } as never)
  })

  it('requires sign-in', async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      status: 'signed-out',
    } as never)

    const response = await POST(postRequest(), context)
    expect(response.status).toBe(401)
    expect(askPullRequestReviewAgent).not.toHaveBeenCalled()
  })

  it('runs the agent turn for the thread and returns the result', async () => {
    const response = await POST(postRequest(), context)

    expect(response.status).toBe(200)
    expect(askPullRequestReviewAgent).toHaveBeenCalledWith({
      requestedByUserId: 'db-user-1',
      threadId: 'thread-1',
    })
    await expect(response.json()).resolves.toMatchObject({
      agentComment: { id: 'comment-2' },
    })
  })

  it('maps service errors to their HTTP status', async () => {
    vi.mocked(askPullRequestReviewAgent).mockRejectedValue(
      new PullRequestReviewAgentSessionError(
        'daemon',
        'The review agent session failed while answering.',
        502,
      ),
    )

    const response = await POST(postRequest(), context)
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'The review agent session failed while answering.',
    })
  })
})
