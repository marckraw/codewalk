import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

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
    advancePullRequestReviewAgentReply: vi.fn(),
    PullRequestReviewAgentSessionError,
    startPullRequestReviewAgentReply: vi.fn(),
  }
})

import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { upsertAuthenticatedUser } from '@/entities/database'
import {
  advancePullRequestReviewAgentReply,
  PullRequestReviewAgentSessionError,
  startPullRequestReviewAgentReply,
} from '@/features/pr-review-agent-session'

function request(method: string) {
  return new Request(
    'http://localhost/api/review-threads/thread-1/agent-reply',
    { method },
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
    vi.mocked(startPullRequestReviewAgentReply).mockResolvedValue({
      thread: { id: 'thread-1' },
    } as never)
    vi.mocked(advancePullRequestReviewAgentReply).mockResolvedValue({
      thread: { id: 'thread-1' },
    } as never)
  })

  it('requires sign-in for both verbs', async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      status: 'signed-out',
    } as never)

    expect((await POST(request('POST'), context)).status).toBe(401)
    expect((await GET(request('GET'), context)).status).toBe(401)
    expect(startPullRequestReviewAgentReply).not.toHaveBeenCalled()
    expect(advancePullRequestReviewAgentReply).not.toHaveBeenCalled()
  })

  it('starts an agent reply and returns 202 immediately', async () => {
    const response = await POST(request('POST'), context)

    expect(response.status).toBe(202)
    expect(startPullRequestReviewAgentReply).toHaveBeenCalledWith({
      requestedByUserId: 'db-user-1',
      threadId: 'thread-1',
    })
  })

  it('advances the turn on poll', async () => {
    const response = await GET(request('GET'), context)

    expect(response.status).toBe(200)
    expect(advancePullRequestReviewAgentReply).toHaveBeenCalledWith({
      threadId: 'thread-1',
    })
  })

  it('maps service errors to their HTTP status', async () => {
    vi.mocked(startPullRequestReviewAgentReply).mockRejectedValue(
      new PullRequestReviewAgentSessionError(
        'daemon',
        'The agent session failed while answering.',
        502,
      ),
    )

    const response = await POST(request('POST'), context)
    expect(response.status).toBe(502)
  })
})
