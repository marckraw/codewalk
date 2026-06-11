import 'server-only'

import {
  AgentsDaemonClient,
  AgentsDaemonClientError,
  createAgentsDaemonClient,
  type AgentsDaemonClientOptions,
} from '@/entities/agents-daemon'
import {
  getAgentsDaemonConfig,
  type AgentsDaemonConfigResult,
} from '@/entities/agents-daemon'
import {
  attachDaemonJobToCodeReviewGuideGeneration,
  finishCodeReviewGuideGeneration,
  getCodeReviewGuideGenerationBySnapshotId,
  startCodeReviewGuideGeneration,
  type CodeReviewGuideGenerationRow,
  type FinishCodeReviewGuideGenerationInput,
} from '@/entities/database'
import type { AgentsDaemonGuideJob } from '@/entities/agents-daemon'
import {
  buildCodewalkReviewCommentBody,
  buildCodewalkReviewUrl,
  createServerGitHubRestClient,
  getCodewalkAppBaseUrl,
  getGitHubWebhookConfig,
  upsertCodewalkReviewComment,
} from '@/entities/github-server'
import { shouldReconcileCodeReviewGuideGeneration } from './code-review-guide-generation.pure'
import {
  persistCodeReviewGuide,
  type CodeReviewGuide,
} from '@/entities/database'
import {
  getPullRequestSnapshotById,
  type PullRequestSnapshotRow,
} from '@/entities/database'
import {
  logCodewalkError,
  logCodewalkEvent,
  logCodewalkWarning,
} from '@/shared/lib/observability'

export type GenerateCodeReviewGuideInput = {
  force?: boolean
  onFailed?: (context: {
    error: string
    generation: Awaited<ReturnType<typeof finishCodeReviewGuideGeneration>>
    snapshot: PullRequestSnapshotRow
  }) => Promise<void>
  onStarted?: (context: {
    generation: Awaited<ReturnType<typeof startCodeReviewGuideGeneration>>
    snapshot: PullRequestSnapshotRow
  }) => Promise<void>
  requestedByUserId: string | null
  snapshotId: string
}

export type CodeReviewGuideGenerationErrorCode =
  | 'configuration'
  | 'daemon'
  | 'not-found'
  | 'persistence'
  | 'unexpected'

export class CodeReviewGuideGenerationError extends Error {
  constructor(
    public readonly code: CodeReviewGuideGenerationErrorCode,
    message: string,
    public readonly status: number,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'CodeReviewGuideGenerationError'
  }
}

export function buildRepositoryUrlFromSnapshot(
  snapshot: Pick<PullRequestSnapshotRow, 'owner' | 'repo'>,
) {
  return `https://github.com/${snapshot.owner}/${snapshot.repo}`
}

export type SubmitCodeReviewGuideGenerationJobResult = {
  generation: CodeReviewGuideGenerationRow
}

export type StartCodeReviewGuideGenerationRunResult = {
  /**
   * Submits the generation as an agents-daemon job (fast — the daemon does
   * the long work in its own queue) and records the job id on the
   * `code_review_guide_generations` row. The outcome lands later via
   * reconcile-on-poll (or, eventually, the daemon's completion callback).
   */
  complete: () => Promise<SubmitCodeReviewGuideGenerationJobResult>
  generation: Awaited<ReturnType<typeof startCodeReviewGuideGeneration>>
  snapshot: PullRequestSnapshotRow
}

export async function startCodeReviewGuideGenerationRun(
  input: GenerateCodeReviewGuideInput,
): Promise<StartCodeReviewGuideGenerationRunResult> {
  const snapshot = await getPullRequestSnapshotById(input.snapshotId)

  if (!snapshot) {
    throw new CodeReviewGuideGenerationError(
      'not-found',
      'Pull request snapshot was not found.',
      404,
    )
  }

  const config = getAgentsDaemonConfig()

  const startedGeneration = await startCodeReviewGuideGeneration({
    effort: config.ok ? config.config.defaultEffort : null,
    force: input.force ?? false,
    model: config.ok ? config.config.defaultModel : null,
    provider: config.ok ? config.config.defaultProvider : null,
    requestedByUserId: input.requestedByUserId,
    snapshotId: input.snapshotId,
  })
  logCodewalkEvent('codewalk.guide_generation.started', {
    force: input.force ?? false,
    generationId: startedGeneration.id,
    owner: snapshot.owner,
    pullRequestNumber: snapshot.number,
    repo: snapshot.repo,
    requestedByUser: Boolean(input.requestedByUserId),
    snapshotId: snapshot.id,
  })
  await input.onStarted?.({ generation: startedGeneration, snapshot })

  if (!config.ok) {
    const failedGeneration = await markGenerationFailed(
      input.snapshotId,
      config.message,
    )
    logCodewalkWarning('codewalk.guide_generation.configuration_failed', {
      generationId: failedGeneration.id,
      owner: snapshot.owner,
      pullRequestNumber: snapshot.number,
      repo: snapshot.repo,
      snapshotId: snapshot.id,
      state: config.state,
    })
    await input.onFailed?.({
      error: config.message,
      generation: failedGeneration,
      snapshot,
    })
    throw new CodeReviewGuideGenerationError(
      'configuration',
      config.message,
      503,
    )
  }

  return {
    complete: () =>
      submitCodeReviewGuideGenerationJob(
        input,
        snapshot,
        config,
        startedGeneration.id,
      ),
    generation: startedGeneration,
    snapshot,
  }
}

async function submitCodeReviewGuideGenerationJob(
  input: GenerateCodeReviewGuideInput,
  snapshot: PullRequestSnapshotRow,
  config: Extract<AgentsDaemonConfigResult, { ok: true }>,
  generationId: string,
): Promise<SubmitCodeReviewGuideGenerationJobResult> {
  try {
    const client = createClient(config)
    const submission = await client.submitCodeReviewGuideJob({
      effort: config.config.defaultEffort,
      force: input.force,
      model: config.config.defaultModel,
      provider: config.config.defaultProvider,
      pullRequestNumber: snapshot.number,
      repository: buildRepositoryUrlFromSnapshot(snapshot),
    })
    const generation = await attachDaemonJobToCodeReviewGuideGeneration({
      daemonCallbackSecret: null,
      daemonJobId: submission.jobId,
      snapshotId: snapshot.id,
    })
    logCodewalkEvent('codewalk.guide_generation.job_submitted', {
      daemonJobId: submission.jobId,
      generationId,
      model: config.config.defaultModel,
      owner: snapshot.owner,
      provider: config.config.defaultProvider,
      pullRequestNumber: snapshot.number,
      repo: snapshot.repo,
      snapshotId: snapshot.id,
    })

    return { generation }
  } catch (error) {
    const message = safeGenerationErrorMessage(error)
    const failedGeneration = await markGenerationFailed(
      input.snapshotId,
      message,
    )
    logCodewalkError('codewalk.guide_generation.failed', {
      error,
      generationId: failedGeneration.id,
      message,
      owner: snapshot.owner,
      pullRequestNumber: snapshot.number,
      repo: snapshot.repo,
      snapshotId: snapshot.id,
    })
    await input.onFailed?.({
      error: message,
      generation: failedGeneration,
      snapshot,
    })

    if (error instanceof AgentsDaemonClientError) {
      throw new CodeReviewGuideGenerationError(
        'daemon',
        message,
        statusForDaemonError(error),
        error,
      )
    }

    throw new CodeReviewGuideGenerationError('unexpected', message, 500, error)
  }
}

export type ReconcileCodeReviewGuideGenerationResult =
  | {
      action: 'none'
      reason:
        | 'no-generation'
        | 'not-running'
        | 'no-job'
        | 'too-fresh'
        | 'job-pending'
        | 'daemon-unavailable'
        | 'snapshot-missing'
    }
  | { action: 'finalized'; status: 'ready' | 'failed' }

/**
 * Pull the daemon's ground truth for a generation that is still `running`
 * and finalize it when the job reached a terminal state. Called from the
 * workspace read path (page + polling API), so it must never throw — a
 * reconcile problem degrades to "still preparing", not a broken review.
 */
export async function reconcileCodeReviewGuideGenerationForSnapshot(
  snapshotId: string,
  now = new Date(),
): Promise<ReconcileCodeReviewGuideGenerationResult> {
  try {
    const generation =
      await getCodeReviewGuideGenerationBySnapshotId(snapshotId)
    const decision = shouldReconcileCodeReviewGuideGeneration(generation, now)

    if (!decision.reconcile) {
      return { action: 'none', reason: decision.reason }
    }

    const config = getAgentsDaemonConfig()

    if (!config.ok) {
      return { action: 'none', reason: 'daemon-unavailable' }
    }

    let job: AgentsDaemonGuideJob

    try {
      job = await createClient(config).getCodeReviewGuideJob(
        decision.daemonJobId,
      )
    } catch (error) {
      if (
        error instanceof AgentsDaemonClientError &&
        error.details.status === 404
      ) {
        // The daemon no longer knows the job (restart with data loss); fail
        // the row so the UI stops polling and offers a retry.
        job = {
          error:
            'The daemon no longer knows this generation job. Retry to start a new run.',
          jobId: decision.daemonJobId,
          result: null,
          status: 'failed',
        }
      } else {
        logCodewalkWarning('codewalk.guide_generation.reconcile_unreachable', {
          daemonJobId: decision.daemonJobId,
          error: error instanceof Error ? error.message : String(error),
          snapshotId,
        })
        return { action: 'none', reason: 'daemon-unavailable' }
      }
    }

    return await finalizeCodeReviewGuideGenerationFromJob({ job, snapshotId })
  } catch (error) {
    logCodewalkError('codewalk.guide_generation.reconcile_failed', {
      error,
      snapshotId,
    })
    return { action: 'none', reason: 'daemon-unavailable' }
  }
}

/**
 * Persist a terminal job outcome onto the generation row (and the guide
 * itself when ready), then update the Codewalk PR comment if this run owns
 * one. Idempotent: the guide upserts by cache identity and re-finishing the
 * row writes the same values, so a reconcile/callback race is harmless.
 */
export async function finalizeCodeReviewGuideGenerationFromJob(params: {
  job: AgentsDaemonGuideJob
  snapshotId: string
}): Promise<ReconcileCodeReviewGuideGenerationResult> {
  const { job, snapshotId } = params

  if (job.status === 'queued' || job.status === 'running') {
    return { action: 'none', reason: 'job-pending' }
  }

  const snapshot = await getPullRequestSnapshotById(snapshotId)

  if (!snapshot) {
    return { action: 'none', reason: 'snapshot-missing' }
  }

  if (job.status === 'ready' && job.result) {
    const daemonGuide: CodeReviewGuide = job.result.guide
    const guide = await persistCodeReviewGuide({
      guide: daemonGuide,
      snapshotId,
    })
    const generation = await finishCodeReviewGuideGeneration({
      error: null,
      guideId: guide.id,
      snapshotId,
      status: 'ready',
    })
    logCodewalkEvent('codewalk.guide_generation.ready', {
      daemonJobId: job.jobId,
      generationId: generation.id,
      guideId: guide.id,
      owner: snapshot.owner,
      pullRequestNumber: snapshot.number,
      repo: snapshot.repo,
      snapshotId,
    })
    await updateReviewCommentForGeneration({
      generation,
      snapshot,
      state: 'ready',
    })

    return { action: 'finalized', status: 'ready' }
  }

  const message =
    job.status === 'ready'
      ? 'The daemon reported a ready job without a result.'
      : (job.error ?? 'Guide generation failed on the daemon.')
  const generation = await markGenerationFailed(snapshotId, message)
  logCodewalkError('codewalk.guide_generation.failed', {
    daemonJobId: job.jobId,
    generationId: generation.id,
    message,
    owner: snapshot.owner,
    pullRequestNumber: snapshot.number,
    repo: snapshot.repo,
    snapshotId,
  })
  await updateReviewCommentForGeneration({
    error: message,
    generation,
    snapshot,
    state: 'failed',
  })

  return { action: 'finalized', status: 'failed' }
}

/**
 * Update the Codewalk-owned PR comment for webhook-initiated runs (those
 * carry a `githubCommentId`). UI-initiated runs have no comment — no-op.
 * Comment trouble must not fail the finalize that already persisted state.
 */
async function updateReviewCommentForGeneration(params: {
  error?: string | null
  generation: CodeReviewGuideGenerationRow
  snapshot: PullRequestSnapshotRow
  state: 'ready' | 'failed'
}) {
  if (!params.generation.githubCommentId) {
    return
  }

  try {
    const webhookConfig = getGitHubWebhookConfig()

    if (!webhookConfig.ok) {
      logCodewalkWarning('codewalk.guide_generation.comment_skipped', {
        reason: 'webhook-config-missing',
        snapshotId: params.snapshot.id,
      })
      return
    }

    const github = createServerGitHubRestClient(webhookConfig.botToken)
    await upsertCodewalkReviewComment({
      body: buildCodewalkReviewCommentBody({
        error: params.error,
        reviewUrl: buildCodewalkReviewUrl({
          appBaseUrl: getCodewalkAppBaseUrl(),
          snapshotId: params.snapshot.id,
          view: 'guide',
        }),
        state: params.state,
      }),
      existingCommentId: params.generation.githubCommentId,
      github,
      pullRequest: {
        number: params.snapshot.number,
        owner: params.snapshot.owner,
        repo: params.snapshot.repo,
      },
    })
  } catch (error) {
    logCodewalkWarning('codewalk.guide_generation.comment_failed', {
      error: error instanceof Error ? error.message : String(error),
      snapshotId: params.snapshot.id,
      state: params.state,
    })
  }
}

function createClient(
  config: Extract<AgentsDaemonConfigResult, { ok: true }>,
  options?: Partial<AgentsDaemonClientOptions>,
) {
  if (options) {
    return new AgentsDaemonClient({ ...config.config, ...options })
  }

  return createAgentsDaemonClient(config)
}

async function markGenerationFailed(snapshotId: string, error: string) {
  const input: FinishCodeReviewGuideGenerationInput = {
    error,
    guideId: null,
    snapshotId,
    status: 'failed',
  }

  return finishCodeReviewGuideGeneration(input)
}

function safeGenerationErrorMessage(error: unknown) {
  if (error instanceof AgentsDaemonClientError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Guide generation failed.'
}

function statusForDaemonError(error: AgentsDaemonClientError) {
  if (error.code === 'network-error') return 503
  if (error.code === 'invalid-response') return 502
  if (
    error.details.status &&
    error.details.status >= 400 &&
    error.details.status < 500
  )
    return error.details.status
  return 502
}
