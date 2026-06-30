import { describe, expect, it } from 'vitest'
import {
  buildAgentsDaemonExecutionCommandRequestBody,
  buildAgentsDaemonGenerateGuideRequestBody,
  buildAgentsDaemonExecutionStartRequestBody,
  buildAgentsDaemonSubmitGuideJobRequestBody,
  buildAgentsDaemonUrl,
  parseAgentsDaemonConversationItems,
  parseAgentsDaemonExecutionCommandResult,
  parseAgentsDaemonExecutionSessionSnapshot,
  parseAgentsDaemonExecutionStartResult,
  parseAgentsDaemonGenerateGuideResult,
  parseAgentsDaemonGuideJob,
  parseAgentsDaemonGuideJobSubmitResult,
  parseAgentsDaemonHealth,
  parseAgentsDaemonMeta,
  resolveAgentsDaemonBaseUrl,
} from './protocol'

describe('agents-daemon protocol', () => {
  it('normalizes base URLs and builds absolute endpoint URLs', () => {
    expect(
      resolveAgentsDaemonBaseUrl(
        'https://daemon.example.com/path/?debug=1#hash',
      ),
    ).toEqual({
      baseUrl: 'https://daemon.example.com/path',
      ok: true,
    })
    expect(resolveAgentsDaemonBaseUrl('')).toEqual({
      ok: false,
      reason: 'missing',
    })
    expect(resolveAgentsDaemonBaseUrl('file:///tmp/daemon')).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(
      buildAgentsDaemonUrl('https://daemon.example.com/', '/v0/meta'),
    ).toBe('https://daemon.example.com/v0/meta')
  })

  it('builds the daemon guide generation request body', () => {
    expect(
      buildAgentsDaemonGenerateGuideRequestBody({
        effort: ' high ',
        force: true,
        model: ' gpt-5.4 ',
        provider: 'codex',
        pullRequestNumber: 42,
        repository: ' https://github.com/ef-global/example ',
      }),
    ).toEqual({
      effort: 'high',
      force: true,
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

  it('parses health and meta responses', () => {
    expect(parseAgentsDaemonHealth(healthPayload)).toEqual(healthPayload)
    expect(parseAgentsDaemonMeta(metaPayload)).toEqual({
      ...metaPayload,
      providers: [
        {
          authenticated: true,
          available: true,
          cliVersion: 'codex-cli 0.139.0',
          details: 'Codex login ready',
          id: 'codex',
          label: 'Codex',
          models: [
            { label: 'GPT-5.5', slug: 'gpt-5.5' },
            { label: 'GPT-5.4', slug: 'gpt-5.4' },
          ],
        },
        {
          authenticated: false,
          available: true,
          cliVersion: 'claude-code 2.0.0',
          details: 'Claude CLI not authenticated',
          id: 'claude',
          label: 'Claude Code',
          models: [],
        },
      ],
    })
  })

  it('treats older daemon provider listings without cliVersion as unknown', () => {
    expect(
      parseAgentsDaemonMeta({
        ...metaPayload,
        providers: [
          {
            authenticated: true,
            available: true,
            details: 'Codex login ready',
            id: 'codex',
            label: 'Codex',
            models: [{ label: 'GPT-5.5', slug: 'gpt-5.5' }],
          },
        ],
      }).providers[0]?.cliVersion,
    ).toBeNull()
  })

  it('parses the canonical guide generation response', () => {
    const result = parseAgentsDaemonGenerateGuideResult(generatePayload)

    expect(result.guide).toMatchObject({
      generatedBy: 'agent',
      id: 'guide-1',
      mode: 'pull-request',
      overview: 'Review persistence and API boundaries.',
      provider: 'codex',
      status: 'ready',
    })
    expect(result.guide.sections[0]).toMatchObject({
      files: [
        {
          hunkHints: ['@@ -1 +1 @@'],
          path: 'src/lib/db/schema.ts',
          reason: 'Guide schema changed.',
          status: 'modified',
        },
      ],
      id: 'section-1',
      riskLevel: 'medium',
      riskRationale: 'Persistence contract changed.',
    })
  })

  it('rejects invalid guide payloads', () => {
    expect(() =>
      parseAgentsDaemonGenerateGuideResult({
        ...generatePayload,
        guide: {
          ...generatePayload.guide,
          overview: { purpose: 'old shape' },
        },
      }),
    ).toThrow('Invalid guide.overview')
  })

  it('builds the job submission body with an optional callback', () => {
    const base = {
      model: 'gpt-5.4',
      provider: 'codex' as const,
      pullRequestNumber: 42,
      repository: 'https://github.com/ef-global/example',
    }

    expect(buildAgentsDaemonSubmitGuideJobRequestBody(base)).toEqual(
      buildAgentsDaemonGenerateGuideRequestBody(base),
    )
    expect(
      buildAgentsDaemonSubmitGuideJobRequestBody({
        ...base,
        callback: { secret: 'cb-secret', url: 'https://codewalk.example/cb' },
      }),
    ).toMatchObject({
      callback: { secret: 'cb-secret', url: 'https://codewalk.example/cb' },
    })
    expect(() =>
      buildAgentsDaemonSubmitGuideJobRequestBody({
        ...base,
        callback: { secret: ' ', url: 'https://codewalk.example/cb' },
      }),
    ).toThrow('callbacks require')
  })

  it('builds execution start bodies and parses execution snapshots', () => {
    expect(
      buildAgentsDaemonExecutionStartRequestBody({
        continuationToken: ' thread-1 ',
        effort: ' high ',
        initialMessage: ' Ready? ',
        metadata: {
          source: { kind: 'pull-request-review', surface: 'codewalk' },
          thread: {
            conversationId: 'ef-global/example/pull-42',
            id: 'ef-global/example/pull-42',
          },
          user: { id: 'user-1' },
          workspace: {
            id: 'ef-global/example',
            pullRequestNumber: 42,
            ref: 'head-sha',
            repository: 'https://github.com/ef-global/example',
          },
        },
        model: ' gpt-5.5 ',
        providerId: ' codex ',
        sessionId: ' session-1 ',
        workspace: {
          ref: 'head-sha',
          repository: 'https://github.com/ef-global/example',
        },
      }),
    ).toEqual({
      config: {
        continuationToken: 'thread-1',
        effort: 'high',
        initialMessage: 'Ready?',
        model: 'gpt-5.5',
        sessionId: 'session-1',
        workingDirectory: '/tmp',
      },
      metadata: {
        source: { kind: 'pull-request-review', surface: 'codewalk' },
        thread: {
          conversationId: 'ef-global/example/pull-42',
          id: 'ef-global/example/pull-42',
        },
        user: { id: 'user-1' },
        workspace: {
          id: 'ef-global/example',
          pullRequestNumber: 42,
          ref: 'head-sha',
          repository: 'https://github.com/ef-global/example',
        },
      },
      protocolVersion: 1,
      providerId: 'codex',
      workspace: {
        ref: 'head-sha',
        repository: 'https://github.com/ef-global/example',
      },
    })

    expect(
      parseAgentsDaemonExecutionStartResult({
        protocolVersion: 1,
        sessionId: 'session-1',
      }),
    ).toEqual({ protocolVersion: 1, sessionId: 'session-1' })

    expect(
      parseAgentsDaemonExecutionSessionSnapshot(executionSnapshot),
    ).toEqual(executionSnapshot)
  })

  it('builds send-message command envelopes and parses command results', () => {
    expect(
      buildAgentsDaemonExecutionCommandRequestBody({
        sessionId: ' session-1 ',
        text: ' What does this do? ',
      }),
    ).toEqual({
      command: { kind: 'send-message', text: 'What does this do?' },
      protocolVersion: 1,
      sessionId: 'session-1',
    })

    expect(() =>
      buildAgentsDaemonExecutionCommandRequestBody({
        sessionId: 'session-1',
        text: '  ',
      }),
    ).toThrow('require text')

    expect(parseAgentsDaemonExecutionCommandResult({ accepted: true })).toEqual(
      { accepted: true },
    )
    expect(() => parseAgentsDaemonExecutionCommandResult({})).toThrow(
      'Invalid accepted',
    )
  })

  it('parses conversation items leniently', () => {
    expect(
      parseAgentsDaemonConversationItems([
        {
          actor: 'assistant',
          id: 'item-2',
          kind: 'message',
          state: 'complete',
          text: 'It validates the token.',
        },
        { id: 'item-3', kind: 'tool-call', toolName: 'grep' },
        { nonsense: true },
        null,
      ]),
    ).toEqual([
      {
        actor: 'assistant',
        id: 'item-2',
        kind: 'message',
        state: 'complete',
        text: 'It validates the token.',
      },
      {
        actor: null,
        id: 'item-3',
        kind: 'tool-call',
        state: null,
        text: null,
      },
    ])
  })

  it('parses job submissions and job records', () => {
    expect(
      parseAgentsDaemonGuideJobSubmitResult({
        jobId: 'job-1',
        status: 'queued',
      }),
    ).toEqual({ jobId: 'job-1', status: 'queued' })
    expect(() =>
      parseAgentsDaemonGuideJobSubmitResult({ jobId: 'job-1', status: 'odd' }),
    ).toThrow('Invalid guide job status')

    expect(
      parseAgentsDaemonGuideJob({
        error: null,
        jobId: 'job-1',
        result: null,
        status: 'running',
      }),
    ).toEqual({ error: null, jobId: 'job-1', result: null, status: 'running' })

    const ready = parseAgentsDaemonGuideJob({
      error: null,
      jobId: 'job-1',
      result: generatePayload,
      status: 'ready',
    })
    expect(ready.result?.guide.id).toBe('guide-1')

    expect(
      parseAgentsDaemonGuideJob({
        error: 'generation crashed',
        jobId: 'job-1',
        result: null,
        status: 'failed',
      }),
    ).toMatchObject({ error: 'generation crashed', status: 'failed' })
  })
})

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
      features: {
        attachmentKinds: ['image'],
        effortLevels: ['none', 'low', 'medium', 'high', 'xhigh'],
        followup: true,
        planMode: true,
        resume: true,
        streaming: true,
        structuredRequests: true,
      },
      id: 'codex',
      label: 'Codex',
      models: [
        { label: 'GPT-5.5', slug: 'gpt-5.5' },
        { label: 'GPT-5.4', slug: 'gpt-5.4' },
      ],
    },
    {
      authenticated: false,
      available: true,
      cliVersion: 'claude-code 2.0.0',
      details: 'Claude CLI not authenticated',
      id: 'claude',
      label: 'Claude Code',
      models: 'invalid',
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
    sections: [
      {
        checklist: ['Check migration.', 'Check renderer assumptions.'],
        files: [
          {
            hunkHints: ['@@ -1 +1 @@'],
            path: 'src/lib/db/schema.ts',
            reason: 'Guide schema changed.',
            status: 'modified',
          },
        ],
        id: 'section-1',
        narrative: 'The persistence model now follows agents-daemon.',
        riskLevel: 'medium',
        riskRationale: 'Persistence contract changed.',
        summary: 'Guide schema changed.',
        title: 'Guide persistence',
      },
    ],
    status: 'ready',
    summary,
    targetId: 'pull-request:https://github.com/ef-global/example#42',
    updatedAt: '2026-06-09T08:01:00.000Z',
  },
  pullRequest,
  summary,
}
