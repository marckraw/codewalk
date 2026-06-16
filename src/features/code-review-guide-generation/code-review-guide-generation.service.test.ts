import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentsDaemonClientError } from '@/entities/agents-daemon'
import {
  CodeReviewGuideGenerationError,
  buildRepositoryUrlFromSnapshot,
  finalizeCodeReviewGuideGenerationFromJob,
  reconcileCodeReviewGuideGenerationForSnapshot,
  reconcileInFlightCodeReviewGuideGenerations,
  startCodeReviewGuideGenerationRun,
} from './code-review-guide-generation.service'

vi.mock('server-only', () => ({}))

vi.mock('@/entities/agents-daemon', async () => {
  const actual = await vi.importActual<
    typeof import('@/entities/agents-daemon')
  >('@/entities/agents-daemon')

  return {
    ...actual,
    createAgentsDaemonClient: vi.fn(),
    getAgentsDaemonConfig: vi.fn(),
  }
})

vi.mock('@/entities/database', () => ({
  attachDaemonJobToCodeReviewGuideGeneration: vi.fn(),
  finishCodeReviewGuideGeneration: vi.fn(),
  getCodeReviewGuideGenerationBySnapshotId: vi.fn(),
  listRunningCodeReviewGuideGenerationSnapshotIds: vi.fn(),
  getPullRequestSnapshotById: vi.fn(),
  persistCodeReviewGuide: vi.fn(),
  startCodeReviewGuideGeneration: vi.fn(),
}))

vi.mock('@/entities/github-server', () => ({
  buildCodewalkReviewCommentBody: vi.fn(() => 'comment-body'),
  buildCodewalkReviewUrl: vi.fn(() => 'https://codewalk.example/review/x'),
  createServerGitHubRestClient: vi.fn(() => ({}) as never),
  getCodewalkAppBaseUrl: vi.fn(() => 'https://codewalk.example'),
  getGitHubWebhookConfig: vi.fn(),
  upsertCodewalkReviewComment: vi.fn(),
}))

import {
  createAgentsDaemonClient,
  getAgentsDaemonConfig,
} from '@/entities/agents-daemon'
import {
  attachDaemonJobToCodeReviewGuideGeneration,
  finishCodeReviewGuideGeneration,
  getCodeReviewGuideGenerationBySnapshotId,
  listRunningCodeReviewGuideGenerationSnapshotIds,
  getPullRequestSnapshotById,
  persistCodeReviewGuide,
  startCodeReviewGuideGeneration,
} from '@/entities/database'
import {
  getGitHubWebhookConfig,
  upsertCodewalkReviewComment,
} from '@/entities/github-server'

const daemonConfig = {
  config: {
    apiToken: 'daemon-token',
    baseUrl: 'https://daemon.example.com',
    defaultEffort: 'high',
    defaultModel: 'gpt-5.4',
    defaultProvider: 'codex',
    requestTimeoutMs: 600000,
  },
  ok: true,
} as const

describe('buildRepositoryUrlFromSnapshot', () => {
  it('builds the GitHub repository URL expected by agents-daemon', () => {
    expect(
      buildRepositoryUrlFromSnapshot({ owner: 'ef-global', repo: 'example' }),
    ).toBe('https://github.com/ef-global/example')
  })
})

describe('reconcileInFlightCodeReviewGuideGenerations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reconciles every running generation', async () => {
    vi.mocked(
      listRunningCodeReviewGuideGenerationSnapshotIds,
    ).mockResolvedValue(['s1', 's2'])
    // A null generation makes each per-snapshot reconcile short-circuit before
    // any daemon call, so we only assert the fan-out happened.
    vi.mocked(getCodeReviewGuideGenerationBySnapshotId).mockResolvedValue(null)

    await reconcileInFlightCodeReviewGuideGenerations()

    expect(getCodeReviewGuideGenerationBySnapshotId).toHaveBeenCalledWith('s1')
    expect(getCodeReviewGuideGenerationBySnapshotId).toHaveBeenCalledWith('s2')
    expect(getCodeReviewGuideGenerationBySnapshotId).toHaveBeenCalledTimes(2)
  })

  it('does nothing when no generation is running', async () => {
    vi.mocked(
      listRunningCodeReviewGuideGenerationSnapshotIds,
    ).mockResolvedValue([])

    await reconcileInFlightCodeReviewGuideGenerations()

    expect(getCodeReviewGuideGenerationBySnapshotId).not.toHaveBeenCalled()
  })
})

describe('startCodeReviewGuideGenerationRun', () => {
  const submitCodeReviewGuideJob = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPullRequestSnapshotById).mockResolvedValue(
      fixtureSnapshot as never,
    )
    vi.mocked(getAgentsDaemonConfig).mockReturnValue(daemonConfig as never)
    submitCodeReviewGuideJob.mockResolvedValue({
      jobId: 'daemon-job-id',
      status: 'queued',
    })
    vi.mocked(createAgentsDaemonClient).mockReturnValue({
      submitCodeReviewGuideJob,
    } as never)
    vi.mocked(startCodeReviewGuideGeneration).mockResolvedValue({
      id: 'generation-id',
    } as never)
    vi.mocked(attachDaemonJobToCodeReviewGuideGeneration).mockResolvedValue({
      daemonJobId: 'daemon-job-id',
      id: 'generation-id',
      status: 'running',
    } as never)
  })

  it('persists the running row, submits a daemon job, and records the job id', async () => {
    const run = await startCodeReviewGuideGenerationRun({
      force: true,
      requestedByUserId: 'user-id',
      snapshotId: 'snapshot-id',
    })

    expect(run.generation.id).toBe('generation-id')
    expect(submitCodeReviewGuideJob).not.toHaveBeenCalled()

    const result = await run.complete()

    expect(result.generation.daemonJobId).toBe('daemon-job-id')
    expect(submitCodeReviewGuideJob).toHaveBeenCalledWith({
      effort: 'high',
      force: true,
      model: 'gpt-5.4',
      provider: 'codex',
      pullRequestNumber: 42,
      repository: 'https://github.com/ef-global/example',
    })
    expect(attachDaemonJobToCodeReviewGuideGeneration).toHaveBeenCalledWith({
      daemonCallbackSecret: null,
      daemonJobId: 'daemon-job-id',
      snapshotId: 'snapshot-id',
    })
    expect(finishCodeReviewGuideGeneration).not.toHaveBeenCalled()
  })

  it('fails before starting when the snapshot is missing', async () => {
    vi.mocked(getPullRequestSnapshotById).mockResolvedValue(null)

    await expect(
      startCodeReviewGuideGenerationRun({
        requestedByUserId: 'user-id',
        snapshotId: 'missing-snapshot',
      }),
    ).rejects.toMatchObject({
      code: 'not-found',
      status: 404,
    } satisfies Partial<CodeReviewGuideGenerationError>)
    expect(startCodeReviewGuideGeneration).not.toHaveBeenCalled()
  })

  it('records configuration failures for an existing snapshot', async () => {
    vi.mocked(getAgentsDaemonConfig).mockReturnValue({
      message: 'DEFAULT_GUIDE_MODEL is required for remote guided reviews.',
      missingKeys: ['DEFAULT_GUIDE_MODEL'],
      ok: false,
      state: 'missing-default-model',
    })
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: 'DEFAULT_GUIDE_MODEL is required for remote guided reviews.',
      guideId: null,
      id: 'generation-id',
      status: 'failed',
    } as never)

    await expect(
      startCodeReviewGuideGenerationRun({
        requestedByUserId: 'user-id',
        snapshotId: 'snapshot-id',
      }),
    ).rejects.toMatchObject({
      code: 'configuration',
      status: 503,
    } satisfies Partial<CodeReviewGuideGenerationError>)

    expect(finishCodeReviewGuideGeneration).toHaveBeenCalledWith({
      error: 'DEFAULT_GUIDE_MODEL is required for remote guided reviews.',
      guideId: null,
      snapshotId: 'snapshot-id',
      status: 'failed',
    })
  })

  it('marks the generation failed when the job submission fails', async () => {
    submitCodeReviewGuideJob.mockRejectedValue(
      new AgentsDaemonClientError(
        'network-error',
        'Could not reach agents-daemon.',
      ),
    )
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: 'Could not reach agents-daemon.',
      guideId: null,
      id: 'generation-id',
      status: 'failed',
    } as never)

    const run = await startCodeReviewGuideGenerationRun({
      requestedByUserId: 'user-id',
      snapshotId: 'snapshot-id',
    })

    await expect(run.complete()).rejects.toMatchObject({
      code: 'daemon',
      message: 'Could not reach agents-daemon.',
      status: 503,
    } satisfies Partial<CodeReviewGuideGenerationError>)

    expect(finishCodeReviewGuideGeneration).toHaveBeenCalledWith({
      error: 'Could not reach agents-daemon.',
      guideId: null,
      snapshotId: 'snapshot-id',
      status: 'failed',
    })
    expect(attachDaemonJobToCodeReviewGuideGeneration).not.toHaveBeenCalled()
  })
})

describe('reconcileCodeReviewGuideGenerationForSnapshot', () => {
  const getCodeReviewGuideJob = vi.fn()
  const now = new Date('2026-06-11T12:00:00Z')

  function runningGeneration(overrides: Record<string, unknown> = {}) {
    return {
      daemonJobId: 'daemon-job-id',
      githubCommentId: null,
      id: 'generation-id',
      startedAt: new Date('2026-06-11T11:00:00Z'),
      status: 'running',
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAgentsDaemonConfig).mockReturnValue(daemonConfig as never)
    vi.mocked(createAgentsDaemonClient).mockReturnValue({
      getCodeReviewGuideJob,
    } as never)
    vi.mocked(getPullRequestSnapshotById).mockResolvedValue(
      fixtureSnapshot as never,
    )
    vi.mocked(getCodeReviewGuideGenerationBySnapshotId).mockResolvedValue(
      runningGeneration() as never,
    )
    vi.mocked(persistCodeReviewGuide).mockResolvedValue({
      id: 'db-guide-id',
      status: 'ready',
    } as never)
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: null,
      githubCommentId: null,
      guideId: 'db-guide-id',
      id: 'generation-id',
      status: 'ready',
    } as never)
  })

  it('does nothing when the generation is not running or has no job', async () => {
    vi.mocked(getCodeReviewGuideGenerationBySnapshotId).mockResolvedValue(null)
    await expect(
      reconcileCodeReviewGuideGenerationForSnapshot('snapshot-id', now),
    ).resolves.toEqual({ action: 'none', reason: 'no-generation' })

    vi.mocked(getCodeReviewGuideGenerationBySnapshotId).mockResolvedValue(
      runningGeneration({ status: 'ready' }) as never,
    )
    await expect(
      reconcileCodeReviewGuideGenerationForSnapshot('snapshot-id', now),
    ).resolves.toEqual({ action: 'none', reason: 'not-running' })

    vi.mocked(getCodeReviewGuideGenerationBySnapshotId).mockResolvedValue(
      runningGeneration({ daemonJobId: null }) as never,
    )
    await expect(
      reconcileCodeReviewGuideGenerationForSnapshot('snapshot-id', now),
    ).resolves.toEqual({ action: 'none', reason: 'no-job' })

    expect(getCodeReviewGuideJob).not.toHaveBeenCalled()
  })

  it('leaves fresh submissions alone so the submit can land first', async () => {
    vi.mocked(getCodeReviewGuideGenerationBySnapshotId).mockResolvedValue(
      runningGeneration({
        startedAt: new Date(now.getTime() - 2_000),
      }) as never,
    )

    await expect(
      reconcileCodeReviewGuideGenerationForSnapshot('snapshot-id', now),
    ).resolves.toEqual({ action: 'none', reason: 'too-fresh' })
  })

  it('keeps waiting while the daemon job is still pending', async () => {
    getCodeReviewGuideJob.mockResolvedValue({
      error: null,
      jobId: 'daemon-job-id',
      result: null,
      status: 'running',
    })

    await expect(
      reconcileCodeReviewGuideGenerationForSnapshot('snapshot-id', now),
    ).resolves.toEqual({ action: 'none', reason: 'job-pending' })
    expect(persistCodeReviewGuide).not.toHaveBeenCalled()
  })

  it('finalizes a ready job: persists the guide and finishes the row', async () => {
    getCodeReviewGuideJob.mockResolvedValue({
      error: null,
      jobId: 'daemon-job-id',
      result: { guide: fixtureGuide },
      status: 'ready',
    })

    await expect(
      reconcileCodeReviewGuideGenerationForSnapshot('snapshot-id', now),
    ).resolves.toEqual({ action: 'finalized', status: 'ready' })

    expect(persistCodeReviewGuide).toHaveBeenCalledWith({
      guide: fixtureGuide,
      snapshotId: 'snapshot-id',
    })
    expect(finishCodeReviewGuideGeneration).toHaveBeenCalledWith({
      error: null,
      guideId: 'db-guide-id',
      snapshotId: 'snapshot-id',
      status: 'ready',
    })
    // No PR comment for UI-initiated runs.
    expect(upsertCodewalkReviewComment).not.toHaveBeenCalled()
  })

  it('finalizes a failed job with the daemon error', async () => {
    getCodeReviewGuideJob.mockResolvedValue({
      error: 'Guide generation failed after retry: sections invalid',
      jobId: 'daemon-job-id',
      result: null,
      status: 'failed',
    })
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: 'Guide generation failed after retry: sections invalid',
      githubCommentId: null,
      guideId: null,
      id: 'generation-id',
      status: 'failed',
    } as never)

    await expect(
      reconcileCodeReviewGuideGenerationForSnapshot('snapshot-id', now),
    ).resolves.toEqual({ action: 'finalized', status: 'failed' })

    expect(finishCodeReviewGuideGeneration).toHaveBeenCalledWith({
      error: 'Guide generation failed after retry: sections invalid',
      guideId: null,
      snapshotId: 'snapshot-id',
      status: 'failed',
    })
  })

  it('fails the row when the daemon no longer knows the job', async () => {
    getCodeReviewGuideJob.mockRejectedValue(
      new AgentsDaemonClientError('daemon-error', 'not found', {
        status: 404,
      }),
    )
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: 'gone',
      githubCommentId: null,
      guideId: null,
      id: 'generation-id',
      status: 'failed',
    } as never)

    await expect(
      reconcileCodeReviewGuideGenerationForSnapshot('snapshot-id', now),
    ).resolves.toEqual({ action: 'finalized', status: 'failed' })
  })

  it('degrades to "still preparing" when the daemon is unreachable', async () => {
    getCodeReviewGuideJob.mockRejectedValue(
      new AgentsDaemonClientError(
        'network-error',
        'Could not reach agents-daemon.',
      ),
    )

    await expect(
      reconcileCodeReviewGuideGenerationForSnapshot('snapshot-id', now),
    ).resolves.toEqual({ action: 'none', reason: 'daemon-unavailable' })
    expect(finishCodeReviewGuideGeneration).not.toHaveBeenCalled()
  })
})

describe('finalizeCodeReviewGuideGenerationFromJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPullRequestSnapshotById).mockResolvedValue(
      fixtureSnapshot as never,
    )
    vi.mocked(persistCodeReviewGuide).mockResolvedValue({
      id: 'db-guide-id',
      status: 'ready',
    } as never)
  })

  it('updates the Codewalk PR comment for webhook-initiated runs', async () => {
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: null,
      githubCommentId: 'comment-123',
      guideId: 'db-guide-id',
      id: 'generation-id',
      status: 'ready',
    } as never)
    vi.mocked(getGitHubWebhookConfig).mockReturnValue({
      botToken: 'bot-token',
      ok: true,
    } as never)

    await expect(
      finalizeCodeReviewGuideGenerationFromJob({
        job: {
          error: null,
          jobId: 'daemon-job-id',
          result: { guide: fixtureGuide } as never,
          status: 'ready',
        },
        snapshotId: 'snapshot-id',
      }),
    ).resolves.toEqual({ action: 'finalized', status: 'ready' })

    expect(upsertCodewalkReviewComment).toHaveBeenCalledWith(
      expect.objectContaining({
        existingCommentId: 'comment-123',
        pullRequest: { number: 42, owner: 'ef-global', repo: 'example' },
      }),
    )
  })

  it('treats a ready job without a result as failed', async () => {
    vi.mocked(finishCodeReviewGuideGeneration).mockResolvedValue({
      error: 'The daemon reported a ready job without a result.',
      githubCommentId: null,
      guideId: null,
      id: 'generation-id',
      status: 'failed',
    } as never)

    await expect(
      finalizeCodeReviewGuideGenerationFromJob({
        job: {
          error: null,
          jobId: 'daemon-job-id',
          result: null,
          status: 'ready',
        },
        snapshotId: 'snapshot-id',
      }),
    ).resolves.toEqual({ action: 'finalized', status: 'failed' })
    expect(persistCodeReviewGuide).not.toHaveBeenCalled()
  })
})

const fixtureSnapshot = {
  id: 'snapshot-id',
  number: 42,
  owner: 'ef-global',
  repo: 'example',
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

const fixtureGuide = {
  cacheIdentity,
  createdAt: '2026-06-09T08:00:00.000Z',
  effort: 'high',
  error: null,
  generatedBy: 'agent' as const,
  id: 'daemon-guide-id',
  mode: 'pull-request' as const,
  model: 'gpt-5.4',
  overview: 'Review persistence.',
  provider: 'codex' as const,
  pullRequest,
  pullRequestNumber: 42,
  repository: 'https://github.com/ef-global/example',
  sections: [],
  status: 'ready' as const,
  summary: {
    cacheIdentity,
    files: [],
  },
  targetId: 'pull-request:https://github.com/ef-global/example#42',
  updatedAt: '2026-06-09T08:01:00.000Z',
}
