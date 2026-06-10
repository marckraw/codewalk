import { describe, expect, it, vi } from 'vitest'
import { AgentsDaemonClient, checkAgentsDaemonConnection } from './client'

vi.mock('server-only', () => ({}))

describe('AgentsDaemonClient', () => {
  it('calls public health and authenticated meta endpoints', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(healthPayload))
      .mockResolvedValueOnce(jsonResponse(metaPayload))

    const client = new AgentsDaemonClient({
      apiToken: 'secret-token',
      baseUrl: 'https://daemon.example.com',
      fetch,
    })

    await expect(client.getHealth()).resolves.toEqual(healthPayload)
    await expect(client.getMeta()).resolves.toEqual(metaPayload)

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://daemon.example.com/health',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
        },
        method: 'GET',
      }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://daemon.example.com/v0/meta',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret-token',
        },
        method: 'GET',
      }),
    )
  })

  it('posts guide generation requests to the daemon', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(generatePayload))
    const client = new AgentsDaemonClient({
      apiToken: 'secret-token',
      baseUrl: 'https://daemon.example.com',
      fetch,
    })

    await expect(
      client.generateCodeReviewGuide({
        model: 'gpt-5.4',
        provider: 'codex',
        pullRequestNumber: 42,
        repository: 'https://github.com/ef-global/example',
      }),
    ).resolves.toMatchObject({
      guide: {
        id: 'guide-1',
        overview: 'Review persistence and API boundaries.',
      },
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://daemon.example.com/v0/code-review-guides/generate',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    )
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      model: 'gpt-5.4',
      provider: 'codex',
      source: {
        pullRequest: {
          number: 42,
        },
        repository: 'https://github.com/ef-global/example',
      },
    })
  })

  it('maps aborted requests to timeout diagnostics', async () => {
    const timeoutError = new Error('The operation was aborted.')
    timeoutError.name = 'AbortError'
    const client = new AgentsDaemonClient({
      apiToken: 'secret-token',
      baseUrl: 'https://daemon.example.com',
      fetch: vi.fn().mockRejectedValue(timeoutError),
      requestTimeoutMs: 10,
    })

    await expect(client.getHealth()).rejects.toMatchObject({
      code: 'network-error',
      message: 'agents-daemon request timed out after 10ms.',
    })
  })

  it('maps connection diagnostics states', async () => {
    await expect(
      checkAgentsDaemonConnection({
        config: {
          message: 'Missing URL.',
          missingKeys: ['AGENTS_DAEMON_BASE_URL'],
          ok: false,
          state: 'missing-base-url',
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      state: 'missing-base-url',
    })

    await expect(
      checkAgentsDaemonConnection({
        config: {
          config: {
            apiToken: 'bad-token',
            baseUrl: 'https://daemon.example.com',
            defaultEffort: null,
            defaultModel: 'gpt-5.4',
            defaultProvider: 'codex',
            requestTimeoutMs: 240000,
          },
          ok: true,
        },
        fetch: vi
          .fn()
          .mockResolvedValueOnce(jsonResponse(healthPayload))
          .mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401)),
      }),
    ).resolves.toMatchObject({
      ok: false,
      state: 'auth-failed',
    })
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

const healthPayload = {
  activeSessions: 1,
  apiVersion: 'v0',
  providers: {
    codex: true,
  },
  status: 'ok' as const,
  uptime: 12,
  version: '1.0.0',
}

const metaPayload = {
  apiVersion: 'v0',
  deployment: {
    mode: 'shared',
    sharedAcrossTeams: true,
  },
  git: {
    githubAuthenticated: true,
  },
  name: 'agents-daemon',
  providers: [],
  runtime: {
    activeSessions: 1,
    host: '127.0.0.1',
    maxConcurrentAgents: 4,
    port: 3001,
    uptimeSeconds: 12,
  },
  version: '1.0.0',
}

const pullRequest = {
  baseBranch: 'main',
  headBranch: 'feature',
  headRepositoryName: 'example',
  headRepositoryOwner: 'ef-global',
  number: 42,
  provider: 'github' as const,
  repositoryName: 'example',
  repositoryOwner: 'ef-global',
  state: 'open' as const,
  title: 'Add guided review',
  url: 'https://github.com/ef-global/example/pull/42',
}

const cacheIdentity = {
  comparisonPoint: 'base-sha',
  comparisonRef: 'main',
  workingTreeVersionToken: 'head-sha',
}

const summary = {
  cacheIdentity,
  files: [
    {
      file: 'src/lib/db/schema.ts',
      status: 'modified',
    },
  ],
}

const generatePayload = {
  guide: {
    cacheIdentity,
    createdAt: '2026-06-09T08:00:00.000Z',
    effort: null,
    error: null,
    generatedBy: 'agent',
    id: 'guide-1',
    mode: 'pull-request',
    model: 'gpt-5.4',
    overview: 'Review persistence and API boundaries.',
    provider: 'codex',
    pullRequest,
    pullRequestNumber: 42,
    repository: 'https://github.com/ef-global/example',
    sections: [],
    status: 'ready',
    summary,
    targetId: 'pull-request:https://github.com/ef-global/example#42',
    updatedAt: '2026-06-09T08:01:00.000Z',
  },
  pullRequest,
  summary,
}
