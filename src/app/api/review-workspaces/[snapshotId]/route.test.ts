import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/entities/auth-server', () => ({
  getCurrentCodewalkUser: vi.fn(),
}))

vi.mock('@/entities/database', () => ({
  getReviewWorkspace: vi.fn(),
}))

import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { getReviewWorkspace } from '@/entities/database'

function request() {
  return new Request('http://localhost/api/review-workspaces/snap-1')
}

function context(snapshotId: string) {
  return { params: Promise.resolve({ snapshotId }) }
}

const workspace = {
  files: [],
  generation: null,
  guide: null,
  snapshot: { id: 'snap-1', number: 7, owner: 'ef-global', repo: 'backpack' },
  state: 'preparing',
}

describe('GET /api/review-workspaces/[snapshotId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: 'reviewer@example.com',
      name: 'Reviewer',
      status: 'authenticated',
      userId: 'clerk-user-id',
    })
    vi.mocked(getReviewWorkspace).mockResolvedValue(workspace as never)
  })

  it('returns the workspace for authenticated users', async () => {
    const response = await GET(request(), context('snap-1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toMatchObject({ state: 'preparing' })
    expect(getReviewWorkspace).toHaveBeenCalledWith('snap-1')
  })

  it('requires Clerk authentication', async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      status: 'signed-out',
    })

    const response = await GET(request(), context('snap-1'))

    expect(response.status).toBe(401)
    expect(getReviewWorkspace).not.toHaveBeenCalled()
  })

  it('returns 503 when Clerk is misconfigured', async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      missingKeys: ['CLERK_SECRET_KEY'],
      status: 'misconfigured',
    })

    const response = await GET(request(), context('snap-1'))

    expect(response.status).toBe(503)
    expect(getReviewWorkspace).not.toHaveBeenCalled()
  })

  it('returns 404 when the workspace is missing', async () => {
    vi.mocked(getReviewWorkspace).mockResolvedValue(null)

    const response = await GET(request(), context('snap-1'))

    expect(response.status).toBe(404)
  })

  it('rejects a blank snapshot id', async () => {
    const response = await GET(request(), context('   '))

    expect(response.status).toBe(400)
    expect(getReviewWorkspace).not.toHaveBeenCalled()
  })
})
