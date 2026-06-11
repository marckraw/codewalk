import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/entities/auth-server', () => ({
  getCurrentCodewalkUser: vi.fn(),
}))

vi.mock('@/entities/agents-daemon', () => ({
  getAgentsDaemonStatus: vi.fn(),
}))

import { getAgentsDaemonStatus } from '@/entities/agents-daemon'
import { getCurrentCodewalkUser } from '@/entities/auth-server'

describe('GET /api/agents-daemon/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: 'reviewer@example.com',
      name: 'Reviewer',
      status: 'authenticated',
      userId: 'clerk-user-id',
    })
    vi.mocked(getAgentsDaemonStatus).mockResolvedValue({
      baseUrl: 'https://daemon.example.com',
      health: null,
      message: 'Connected to agents-daemon.',
      meta: null,
      ok: true,
      state: 'connected',
    })
  })

  it('returns daemon status for authenticated users', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      baseUrl: 'https://daemon.example.com',
      health: null,
      message: 'Connected to agents-daemon.',
      meta: null,
      ok: true,
      state: 'connected',
    })
  })

  it('requires Clerk authentication', async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      status: 'signed-out',
    })

    const response = await GET()

    expect(response.status).toBe(401)
    expect(getAgentsDaemonStatus).not.toHaveBeenCalled()
  })

  it('returns 503 when daemon configuration or connection is unhealthy', async () => {
    vi.mocked(getAgentsDaemonStatus).mockResolvedValue({
      baseUrl: null,
      health: null,
      message: 'AGENTS_DAEMON_BASE_URL is required for remote guided reviews.',
      meta: null,
      ok: false,
      state: 'missing-base-url',
    })

    const response = await GET()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      state: 'missing-base-url',
    })
  })
})
