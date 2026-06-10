import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from './route'

vi.mock('server-only', () => ({}))

vi.mock('@/entities/auth-server', () => ({
  getCurrentCodewalkUser: vi.fn(),
}))

vi.mock('@/entities/database', () => ({
  listRepositoryReviewRules: vi.fn(),
  upsertAuthenticatedUser: vi.fn(),
  upsertRepositoryReviewRule: vi.fn(),
}))

import { getCurrentCodewalkUser } from '@/entities/auth-server'
import {
  listRepositoryReviewRules,
  upsertAuthenticatedUser,
  upsertRepositoryReviewRule,
} from '@/entities/database'

describe('/api/settings/repository-rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: 'octocat@example.com',
      name: 'Octocat',
      status: 'authenticated',
      userId: 'clerk-user-id',
    })
    vi.mocked(upsertAuthenticatedUser).mockResolvedValue({
      id: 'db-user-id',
    } as never)
    vi.mocked(listRepositoryReviewRules).mockResolvedValue([
      { id: 'rule-id', owner: 'acme', repo: 'widgets', rule: 'allow' } as never,
    ])
    vi.mocked(upsertRepositoryReviewRule).mockResolvedValue({
      id: 'rule-id',
      owner: 'acme',
      repo: 'widgets',
      rule: 'allow',
    } as never)
  })

  it('lists rules for authenticated users', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      rules: [{ id: 'rule-id', owner: 'acme', repo: 'widgets', rule: 'allow' }],
    })
  })

  it('requires authentication', async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      status: 'signed-out',
    })

    expect((await GET()).status).toBe(401)
    expect(
      (
        await POST(
          jsonRequest({
            repository: 'https://github.com/acme/widgets',
            rule: 'allow',
          }),
        )
      ).status,
    ).toBe(401)
    expect(upsertRepositoryReviewRule).not.toHaveBeenCalled()
  })

  it('creates a rule from a pasted repository URL', async () => {
    const response = await POST(
      jsonRequest({
        repository: 'https://github.com/Acme/Widgets',
        rule: 'allow',
      }),
    )

    expect(response.status).toBe(201)
    expect(upsertRepositoryReviewRule).toHaveBeenCalledWith({
      createdByUserId: 'db-user-id',
      owner: 'Acme',
      repo: 'Widgets',
      rule: 'allow',
    })
  })

  it('creates a block rule from the owner/repo shorthand', async () => {
    const response = await POST(
      jsonRequest({ repository: 'ef-global/noisy-repo', rule: 'block' }),
    )

    expect(response.status).toBe(201)
    expect(upsertRepositoryReviewRule).toHaveBeenCalledWith({
      createdByUserId: 'db-user-id',
      owner: 'ef-global',
      repo: 'noisy-repo',
      rule: 'block',
    })
  })

  it('rejects invalid input', async () => {
    expect((await POST(jsonRequest({ rule: 'allow' }))).status).toBe(400)
    expect(
      (await POST(jsonRequest({ repository: 'not a repo', rule: 'allow' })))
        .status,
    ).toBe(400)
    expect(
      (await POST(jsonRequest({ repository: 'acme/widgets', rule: 'maybe' })))
        .status,
    ).toBe(400)
    expect(upsertRepositoryReviewRule).not.toHaveBeenCalled()
  })
})

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/settings/repository-rules', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
}
