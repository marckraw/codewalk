import 'server-only'

import { randomUUID } from 'node:crypto'
import {
  AgentsDaemonClient,
  AgentsDaemonClientError,
  getAgentsDaemonConfig,
  type AgentsDaemonConfigResult,
  type AgentsDaemonExecutionSessionMetadata,
  type AgentsDaemonExecutionSessionSnapshot,
} from '@/entities/agents-daemon'
import {
  getLatestPullRequestSnapshotByRef,
  getPullRequestSnapshotById,
  getReviewAgentSessionForPullRequest,
  getReviewWorkspace,
  startReviewAgentSession,
  updateReviewAgentSessionFromSnapshot,
  type PullRequestSnapshotRow,
  type ReviewAgentSessionRow,
} from '@/entities/database'
import { buildRepositoryUrlFromSnapshot } from '@/features/code-review-guide-generation'
import { getReviewAgentCallbackConfig } from './pr-review-agent-callback.config'
import {
  buildPullRequestReviewAgentInitialPrompt,
  buildPullRequestReviewAgentSessionId,
  type ReviewAgentGuideContext,
} from './pr-review-agent-session.pure'

export type EnsurePullRequestReviewAgentSessionInput = {
  client?: Pick<
    AgentsDaemonClient,
    'getExecutionSession' | 'startExecutionSession'
  >
  requestedByUserId: string | null
  snapshotId: string
}

export type EnsurePullRequestReviewAgentSessionResult = {
  action: 'created' | 'recreated' | 'reused'
  daemonSnapshot: AgentsDaemonExecutionSessionSnapshot
  session: ReviewAgentSessionRow
}

export type PullRequestReviewAgentSessionErrorCode =
  | 'configuration'
  | 'daemon'
  | 'not-found'
  | 'unexpected'

export class PullRequestReviewAgentSessionError extends Error {
  constructor(
    public readonly code: PullRequestReviewAgentSessionErrorCode,
    message: string,
    public readonly status: number,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'PullRequestReviewAgentSessionError'
  }
}

export async function ensurePullRequestReviewAgentSession(
  input: EnsurePullRequestReviewAgentSessionInput,
): Promise<EnsurePullRequestReviewAgentSessionResult> {
  const requested = await getPullRequestSnapshotById(input.snapshotId)

  if (!requested) {
    throw new PullRequestReviewAgentSessionError(
      'not-found',
      'Pull request snapshot was not found.',
      404,
    )
  }

  // The session always follows the LATEST known head of the PR, even when
  // asked from a thread anchored to an older snapshot — the agent must answer
  // about the code that is actually on the branch now.
  const snapshot =
    (await getLatestPullRequestSnapshotByRef({
      number: requested.number,
      owner: requested.owner,
      repo: requested.repo,
    })) ?? requested

  const config = getAgentsDaemonConfig()

  if (!config.ok) {
    throw new PullRequestReviewAgentSessionError(
      'configuration',
      config.message,
      503,
    )
  }

  const client = input.client ?? new AgentsDaemonClient(config.config)
  const existing = await getReviewAgentSessionForPullRequest({
    owner: snapshot.owner,
    pullRequestNumber: snapshot.number,
    repo: snapshot.repo,
  })

  // A session pinned to an older snapshot has a checkout of an older head:
  // skip reuse and recreate at the new ref with the continuation token, so
  // the provider keeps its conversation context but sees the new code.
  const headMoved =
    existing !== null &&
    existing.snapshotId !== null &&
    existing.snapshotId !== snapshot.id

  if (existing && !headMoved) {
    const reused = await tryReuseExistingReviewAgentSession(existing, client)

    if (reused) {
      return reused
    }
  }

  const started = await startRemoteReviewAgentSession({
    client,
    config,
    continuationToken: existing?.continuationToken ?? null,
    requestedByUserId: input.requestedByUserId,
    snapshot,
  })

  return {
    ...started,
    action: existing ? 'recreated' : 'created',
  }
}

async function tryReuseExistingReviewAgentSession(
  existing: ReviewAgentSessionRow,
  client: Pick<AgentsDaemonClient, 'getExecutionSession'>,
): Promise<EnsurePullRequestReviewAgentSessionResult | null> {
  try {
    const daemonSnapshot = await client.getExecutionSession(
      existing.daemonSessionId,
    )

    if (!daemonSnapshot.commandable) {
      return null
    }

    const session = await updateStoredReviewAgentSessionFromDaemonSnapshot({
      daemonSnapshot,
      session: existing,
    })

    return {
      action: 'reused',
      daemonSnapshot,
      session,
    }
  } catch (error) {
    if (isMissingExecutionSessionError(error)) {
      return null
    }

    throw toReviewAgentSessionError(error)
  }
}

async function startRemoteReviewAgentSession(input: {
  client: Pick<
    AgentsDaemonClient,
    'getExecutionSession' | 'startExecutionSession'
  >
  config: Extract<AgentsDaemonConfigResult, { ok: true }>
  continuationToken: string | null
  requestedByUserId: string | null
  snapshot: PullRequestSnapshotRow
}): Promise<Omit<EnsurePullRequestReviewAgentSessionResult, 'action'>> {
  const daemonSessionId = buildPullRequestReviewAgentSessionId({
    nonce: randomUUID(),
    number: input.snapshot.number,
    owner: input.snapshot.owner,
    repo: input.snapshot.repo,
  })

  // When configured, the daemon POSTs this signed callback on turn completion,
  // so the final reply persists even if no browser is polling.
  const callback = getReviewAgentCallbackConfig()

  try {
    const started = await input.client.startExecutionSession({
      // Review sessions run unattended — codewalk has no tool-approval UI, and
      // the agent's fix flow needs to edit + commit. Approvals would hang the
      // turn forever. The push to the PR branch is the human gate (P7).
      automationMode: true,
      ...(callback ? { callback } : {}),
      continuationToken: input.continuationToken,
      effort: input.config.config.defaultEffort,
      initialMessage: buildPullRequestReviewAgentInitialPrompt(
        input.snapshot,
        await loadGuideContextForBootPrompt(input.snapshot.id),
      ),
      metadata: buildReviewAgentExecutionMetadata({
        requestedByUserId: input.requestedByUserId,
        snapshot: input.snapshot,
      }),
      model: input.config.config.defaultModel,
      providerId: input.config.config.defaultProvider,
      sessionId: daemonSessionId,
      workspace: {
        ref: input.snapshot.headSha,
        repository: buildRepositoryUrlFromSnapshot(input.snapshot),
      },
    })
    const daemonSnapshot = await input.client.getExecutionSession(
      started.sessionId,
    )
    const session = await startReviewAgentSession({
      createdByUserId: input.requestedByUserId,
      daemonSessionId: started.sessionId,
      effort: input.config.config.defaultEffort,
      model: input.config.config.defaultModel,
      owner: input.snapshot.owner,
      provider: input.config.config.defaultProvider,
      pullRequestNumber: input.snapshot.number,
      repo: input.snapshot.repo,
      snapshotId: input.snapshot.id,
    })
    const updated = await updateStoredReviewAgentSessionFromDaemonSnapshot({
      daemonSnapshot,
      session,
      snapshotId: input.snapshot.id,
    })

    return {
      daemonSnapshot,
      session: updated,
    }
  } catch (error) {
    throw toReviewAgentSessionError(error)
  }
}

function buildReviewAgentExecutionMetadata(input: {
  requestedByUserId: string | null
  snapshot: PullRequestSnapshotRow
}): AgentsDaemonExecutionSessionMetadata {
  const repository = buildRepositoryUrlFromSnapshot(input.snapshot)
  const threadId = [
    input.snapshot.owner,
    input.snapshot.repo,
    `pull-${input.snapshot.number}`,
  ].join('/')

  return {
    attributes: {
      snapshotId: input.snapshot.id,
    },
    source: {
      id: `codewalk:${threadId}`,
      kind: 'pull-request-review',
      surface: 'codewalk',
    },
    thread: {
      conversationId: threadId,
      id: threadId,
      url: input.snapshot.url,
    },
    ...(input.requestedByUserId
      ? {
          user: {
            id: input.requestedByUserId,
          },
        }
      : {}),
    workspace: {
      attributes: {
        baseRef: input.snapshot.baseRef,
        headRef: input.snapshot.headRef,
      },
      id: `${input.snapshot.owner}/${input.snapshot.repo}`,
      pullRequestNumber: input.snapshot.number,
      ref: input.snapshot.headSha,
      repository,
    },
  }
}

async function updateStoredReviewAgentSessionFromDaemonSnapshot(input: {
  daemonSnapshot: AgentsDaemonExecutionSessionSnapshot
  session: ReviewAgentSessionRow
  snapshotId?: string
}): Promise<ReviewAgentSessionRow> {
  return updateReviewAgentSessionFromSnapshot({
    continuationToken: input.daemonSnapshot.continuationToken,
    daemonSessionId: input.daemonSnapshot.sessionId,
    id: input.session.id,
    lastSeq: input.daemonSnapshot.lastSeq,
    prUrl: input.daemonSnapshot.prUrl,
    snapshotId: input.snapshotId,
    status: input.daemonSnapshot.status,
    workspace: input.daemonSnapshot.workspace,
  })
}

export type PullRequestReviewAgentSessionStatus = {
  activity: string | null
  state: 'none' | 'lost' | 'idle' | 'running' | 'completed' | 'failed'
}

/**
 * Lightweight read used by the UI to show what the agent is doing while a
 * reply is pending. Never creates or recreates sessions.
 */
export async function getPullRequestReviewAgentSessionStatus(input: {
  client?: Pick<AgentsDaemonClient, 'getExecutionSession'>
  owner: string
  pullRequestNumber: number
  repo: string
}): Promise<PullRequestReviewAgentSessionStatus> {
  const existing = await getReviewAgentSessionForPullRequest({
    owner: input.owner,
    pullRequestNumber: input.pullRequestNumber,
    repo: input.repo,
  })

  if (!existing) {
    return { activity: null, state: 'none' }
  }

  const config = getAgentsDaemonConfig()

  if (!config.ok) {
    throw new PullRequestReviewAgentSessionError(
      'configuration',
      config.message,
      503,
    )
  }

  const client = input.client ?? new AgentsDaemonClient(config.config)

  try {
    const snapshot = await client.getExecutionSession(existing.daemonSessionId)
    if (!snapshot.commandable) {
      return { activity: null, state: 'lost' }
    }
    return { activity: snapshot.activity, state: snapshot.status }
  } catch (error) {
    if (isMissingExecutionSessionError(error)) {
      return { activity: null, state: 'lost' }
    }

    throw toReviewAgentSessionError(error)
  }
}

/**
 * Best effort: the boot prompt is richer with the generated guide, but a PR
 * without a ready guide (or a workspace read failure) must not block the
 * agent session.
 */
async function loadGuideContextForBootPrompt(
  snapshotId: string,
): Promise<ReviewAgentGuideContext | null> {
  try {
    const workspace = await getReviewWorkspace(snapshotId)
    const guide = workspace?.guide

    if (!guide || guide.status !== 'ready') {
      return null
    }

    return {
      overview: guide.overview,
      sections: guide.sections.map((section) => ({
        summary: section.summary,
        title: section.title,
      })),
    }
  } catch {
    return null
  }
}

function isMissingExecutionSessionError(error: unknown) {
  return (
    error instanceof AgentsDaemonClientError &&
    error.code === 'daemon-error' &&
    error.details.status === 404
  )
}

function toReviewAgentSessionError(
  error: unknown,
): PullRequestReviewAgentSessionError {
  if (error instanceof PullRequestReviewAgentSessionError) {
    return error
  }

  if (error instanceof AgentsDaemonClientError) {
    return new PullRequestReviewAgentSessionError(
      'daemon',
      error.message,
      error.details.status ?? 502,
      error,
    )
  }

  return new PullRequestReviewAgentSessionError(
    'unexpected',
    error instanceof Error ? error.message : 'Review agent session failed.',
    500,
    error,
  )
}
