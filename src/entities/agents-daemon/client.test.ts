import { describe, expect, it, vi } from 'vitest'
import {
  AgentsDaemonClient,
  checkAgentsDaemonConnection,
  getAgentsDaemonStatus,
} from './client'

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

  it('submits guide jobs and reads job status', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ jobId: 'job-1', status: 'queued' }, 202),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          error: null,
          jobId: 'job-1',
          result: null,
          status: 'running',
        }),
      )
    const client = new AgentsDaemonClient({
      apiToken: 'secret-token',
      baseUrl: 'https://daemon.example.com',
      fetch,
    })

    await expect(
      client.submitCodeReviewGuideJob({
        callback: { secret: 'cb-secret', url: 'https://codewalk.example/cb' },
        model: 'gpt-5.4',
        provider: 'codex',
        pullRequestNumber: 42,
        repository: 'https://github.com/ef-global/example',
      }),
    ).resolves.toEqual({ jobId: 'job-1', status: 'queued' })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://daemon.example.com/v0/code-review-guides/jobs',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      callback: { secret: 'cb-secret', url: 'https://codewalk.example/cb' },
      source: { pullRequest: { number: 42 } },
    })

    await expect(client.getCodeReviewGuideJob('job-1')).resolves.toEqual({
      error: null,
      jobId: 'job-1',
      result: null,
      status: 'running',
    })
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://daemon.example.com/v0/code-review-guides/jobs/job-1',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('starts execution sessions and reads execution snapshots', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ protocolVersion: 1, sessionId: 'session-1' }, 201),
      )
      .mockResolvedValueOnce(jsonResponse(executionSnapshot))
    const client = new AgentsDaemonClient({
      apiToken: 'secret-token',
      baseUrl: 'https://daemon.example.com',
      fetch,
    })

    await expect(
      client.startExecutionSession({
        initialMessage: 'Ready?',
        model: 'gpt-5.5',
        providerId: 'codex',
        sessionId: 'session-1',
        workspace: {
          ref: 'head-sha',
          repository: 'https://github.com/ef-global/example',
        },
      }),
    ).resolves.toEqual({ protocolVersion: 1, sessionId: 'session-1' })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://daemon.example.com/v0/execution/sessions',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      config: {
        initialMessage: 'Ready?',
        sessionId: 'session-1',
      },
      protocolVersion: 1,
      providerId: 'codex',
      workspace: {
        ref: 'head-sha',
        repository: 'https://github.com/ef-global/example',
      },
    })

    await expect(client.getExecutionSession('session-1')).resolves.toEqual(
      executionSnapshot,
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://daemon.example.com/v0/execution/sessions/session-1',
      expect.objectContaining({ method: 'GET' }),
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

  it('uses the same result shape for daemon status checks', async () => {
    await expect(
      getAgentsDaemonStatus({
        config: {
          config: {
            apiToken: 'secret-token',
            baseUrl: 'https://daemon.example.com',
            defaultEffort: null,
            defaultModel: 'gpt-5.5',
            defaultProvider: 'codex',
            requestTimeoutMs: 240000,
          },
          ok: true,
        },
        fetch: vi
          .fn()
          .mockResolvedValueOnce(jsonResponse(healthPayload))
          .mockResolvedValueOnce(jsonResponse(metaPayload)),
      }),
    ).resolves.toMatchObject({
      meta: metaPayload,
      ok: true,
      state: 'connected',
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
  providers: [
    {
      authenticated: true,
      available: true,
      cliVersion: 'codex-cli 0.139.0',
      details: 'Codex login ready',
      id: 'codex',
      label: 'Codex',
      models: [{ label: 'GPT-5.5', slug: 'gpt-5.5' }],
    },
  ],
  runtime: {
    activeSessions: 1,
    host: '127.0.0.1',
    maxConcurrentAgents: 4,
    port: 3001,
    uptimeSeconds: 12,
  },
  version: '1.0.0',
}

const executionSnapshot = {
  activity: null,
  attention: 'none',
  contextWindow: null,
  continuationToken: 'thread-1',
  conversation: [],
  lastSeq: 4,
  prUrl: null,
  protocolVersion: 1,
  providerId: 'codex',
  sessionId: 'session-1',
  status: 'running' as const,
  workspace: {
    baseRef: 'head-sha',
    branchName: 'agent/session-1',
    repository: 'https://github.com/ef-global/example',
  },
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
