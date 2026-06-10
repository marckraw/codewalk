import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/pull-requests/parse', () => {
  it('returns a normalized PR reference for a valid URL', async () => {
    const response = await POST(
      new Request('http://localhost/api/pull-requests/parse', {
        body: JSON.stringify({
          url: 'https://github.com/openai/codex/pull/24',
        }),
        method: 'POST',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      pullRequest: { owner: 'openai', repo: 'codex', number: 24 },
      status: 'parsed',
    })
  })

  it('returns a user-facing error for unsupported URLs', async () => {
    const response = await POST(
      new Request('http://localhost/api/pull-requests/parse', {
        body: JSON.stringify({
          url: 'https://gitlab.com/openai/codex/pull/24',
        }),
        method: 'POST',
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Only github.com pull request URLs are supported in the MVP.',
    })
  })
})
