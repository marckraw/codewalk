import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

vi.mock('@/entities/auth-server', () => ({
  getCurrentCodewalkUser: vi.fn(),
}))

vi.mock('@/entities/database', () => ({
  createReviewThread: vi.fn(),
  listReviewThreadsForPullRequest: vi.fn(),
  upsertAuthenticatedUser: vi.fn(),
}))

import { getCurrentCodewalkUser } from '@/entities/auth-server'
import {
  createReviewThread,
  listReviewThreadsForPullRequest,
  upsertAuthenticatedUser,
} from '@/entities/database'

const validCreateBody = {
  owner: 'ef-global',
  repo: 'backpack',
  number: 42,
  anchorSnapshotId: 'snap-1',
  anchorCommitSha: 'abc123',
  filePath: 'src/index.ts',
  side: 'new',
  lineStart: 10,
  lineEnd: 14,
  excerpt: 'const x = 1',
  body: 'Why is this constant?',
}

function postRequest(body: unknown) {
  return new Request('http://localhost/api/review-threads', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('/api/review-threads', () => {
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
    vi.mocked(listReviewThreadsForPullRequest).mockResolvedValue([])
    vi.mocked(createReviewThread).mockResolvedValue({
      id: 'thread-1',
      comments: [{ id: 'comment-1' }],
    } as never)
  })

  it('rejects listing without the pull request identity', async () => {
    const response = await GET(
      new Request('http://localhost/api/review-threads?owner=ef-global'),
    )
    expect(response.status).toBe(400)
  })

  it('lists threads for a pull request', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/review-threads?owner=ef-global&repo=backpack&number=42',
      ),
    )
    expect(response.status).toBe(200)
    expect(listReviewThreadsForPullRequest).toHaveBeenCalledWith({
      owner: 'ef-global',
      repo: 'backpack',
      pullRequestNumber: 42,
    })
  })

  it('requires sign-in', async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      status: 'signed-out',
    } as never)
    const response = await POST(postRequest(validCreateBody))
    expect(response.status).toBe(401)
  })

  it('rejects invalid create payloads', async () => {
    const response = await POST(
      postRequest({ ...validCreateBody, side: 'sideways' }),
    )
    expect(response.status).toBe(400)
    expect(createReviewThread).not.toHaveBeenCalled()
  })

  it('creates a thread with the first comment attributed to the user', async () => {
    const response = await POST(postRequest(validCreateBody))
    expect(response.status).toBe(201)
    expect(createReviewThread).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'ef-global',
        repo: 'backpack',
        pullRequestNumber: 42,
        createdByUserId: 'db-user-1',
        body: 'Why is this constant?',
      }),
    )
  })
})
