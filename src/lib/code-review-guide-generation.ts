import "server-only";

import {
  AgentsDaemonClient,
  AgentsDaemonClientError,
  createAgentsDaemonClient,
  type AgentsDaemonClientOptions,
} from "@/lib/agents-daemon/client";
import { getAgentsDaemonConfig, type AgentsDaemonConfigResult } from "@/lib/agents-daemon/config";
import {
  finishCodeReviewGuideGeneration,
  startCodeReviewGuideGeneration,
  type FinishCodeReviewGuideGenerationInput,
} from "@/lib/db/code-review-guide-generations";
import { persistCodeReviewGuide, type CodeReviewGuide } from "@/lib/db/code-review-guides";
import { getPullRequestSnapshotById, type PullRequestSnapshotRow } from "@/lib/db/pull-request-snapshots";
import { logCodewalkError, logCodewalkEvent, logCodewalkWarning } from "@/lib/observability";

export type GenerateCodeReviewGuideInput = {
  force?: boolean;
  onFailed?: (context: {
    error: string;
    generation: Awaited<ReturnType<typeof finishCodeReviewGuideGeneration>>;
    snapshot: PullRequestSnapshotRow;
  }) => Promise<void>;
  onReady?: (context: {
    generation: Awaited<ReturnType<typeof finishCodeReviewGuideGeneration>>;
    guide: Awaited<ReturnType<typeof persistCodeReviewGuide>>;
    snapshot: PullRequestSnapshotRow;
  }) => Promise<void>;
  onStarted?: (context: {
    generation: Awaited<ReturnType<typeof startCodeReviewGuideGeneration>>;
    snapshot: PullRequestSnapshotRow;
  }) => Promise<void>;
  requestedByUserId: string | null;
  snapshotId: string;
};

export type GenerateCodeReviewGuideResult = {
  generation: Awaited<ReturnType<typeof finishCodeReviewGuideGeneration>>;
  guide: Awaited<ReturnType<typeof persistCodeReviewGuide>>;
};

export type CodeReviewGuideGenerationErrorCode =
  | "configuration"
  | "daemon"
  | "not-found"
  | "persistence"
  | "unexpected";

export class CodeReviewGuideGenerationError extends Error {
  constructor(
    public readonly code: CodeReviewGuideGenerationErrorCode,
    message: string,
    public readonly status: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CodeReviewGuideGenerationError";
  }
}

export function buildRepositoryUrlFromSnapshot(snapshot: Pick<PullRequestSnapshotRow, "owner" | "repo">) {
  return `https://github.com/${snapshot.owner}/${snapshot.repo}`;
}

export async function generateAndPersistCodeReviewGuide(
  input: GenerateCodeReviewGuideInput,
): Promise<GenerateCodeReviewGuideResult> {
  const snapshot = await getPullRequestSnapshotById(input.snapshotId);

  if (!snapshot) {
    throw new CodeReviewGuideGenerationError("not-found", "Pull request snapshot was not found.", 404);
  }

  const config = getAgentsDaemonConfig();

  const startedGeneration = await startCodeReviewGuideGeneration({
    effort: config.ok ? config.config.defaultEffort : null,
    force: input.force ?? false,
    model: config.ok ? config.config.defaultModel : null,
    provider: config.ok ? config.config.defaultProvider : null,
    requestedByUserId: input.requestedByUserId,
    snapshotId: input.snapshotId,
  });
  logCodewalkEvent("codewalk.guide_generation.started", {
    force: input.force ?? false,
    generationId: startedGeneration.id,
    owner: snapshot.owner,
    pullRequestNumber: snapshot.number,
    repo: snapshot.repo,
    requestedByUser: Boolean(input.requestedByUserId),
    snapshotId: snapshot.id,
  });
  await input.onStarted?.({ generation: startedGeneration, snapshot });

  if (!config.ok) {
    const failedGeneration = await markGenerationFailed(input.snapshotId, config.message);
    logCodewalkWarning("codewalk.guide_generation.configuration_failed", {
      generationId: failedGeneration.id,
      owner: snapshot.owner,
      pullRequestNumber: snapshot.number,
      repo: snapshot.repo,
      snapshotId: snapshot.id,
      state: config.state,
    });
    await input.onFailed?.({ error: config.message, generation: failedGeneration, snapshot });
    throw new CodeReviewGuideGenerationError("configuration", config.message, 503);
  }

  try {
    logCodewalkEvent("codewalk.guide_generation.daemon_request_started", {
      generationId: startedGeneration.id,
      model: config.config.defaultModel,
      owner: snapshot.owner,
      provider: config.config.defaultProvider,
      pullRequestNumber: snapshot.number,
      repo: snapshot.repo,
      requestTimeoutMs: config.config.requestTimeoutMs,
      snapshotId: snapshot.id,
    });
    const client = createClient(config);
    const result = await client.generateCodeReviewGuide({
      effort: config.config.defaultEffort,
      force: input.force,
      model: config.config.defaultModel,
      provider: config.config.defaultProvider,
      pullRequestNumber: snapshot.number,
      repository: buildRepositoryUrlFromSnapshot(snapshot),
    });
    const daemonGuide: CodeReviewGuide = result.guide;
    const guide = await persistCodeReviewGuide({
      guide: daemonGuide,
      snapshotId: snapshot.id,
    });
    const generation = await finishCodeReviewGuideGeneration({
      error: null,
      guideId: guide.id,
      snapshotId: snapshot.id,
      status: "ready",
    });
    logCodewalkEvent("codewalk.guide_generation.ready", {
      generationId: generation.id,
      guideId: guide.id,
      owner: snapshot.owner,
      pullRequestNumber: snapshot.number,
      repo: snapshot.repo,
      snapshotId: snapshot.id,
    });
    await input.onReady?.({ generation, guide, snapshot });

    return { generation, guide };
  } catch (error) {
    const message = safeGenerationErrorMessage(error);
    const failedGeneration = await markGenerationFailed(input.snapshotId, message);
    logCodewalkError("codewalk.guide_generation.failed", {
      error,
      generationId: failedGeneration.id,
      message,
      owner: snapshot.owner,
      pullRequestNumber: snapshot.number,
      repo: snapshot.repo,
      snapshotId: snapshot.id,
    });
    await input.onFailed?.({ error: message, generation: failedGeneration, snapshot });

    if (error instanceof AgentsDaemonClientError) {
      throw new CodeReviewGuideGenerationError("daemon", message, statusForDaemonError(error), error);
    }

    throw new CodeReviewGuideGenerationError("unexpected", message, 500, error);
  }
}

function createClient(config: Extract<AgentsDaemonConfigResult, { ok: true }>, options?: Partial<AgentsDaemonClientOptions>) {
  if (options) {
    return new AgentsDaemonClient({ ...config.config, ...options });
  }

  return createAgentsDaemonClient(config);
}

async function markGenerationFailed(snapshotId: string, error: string) {
  const input: FinishCodeReviewGuideGenerationInput = {
    error,
    guideId: null,
    snapshotId,
    status: "failed",
  };

  return finishCodeReviewGuideGeneration(input);
}

function safeGenerationErrorMessage(error: unknown) {
  if (error instanceof AgentsDaemonClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Guide generation failed.";
}

function statusForDaemonError(error: AgentsDaemonClientError) {
  if (error.code === "network-error") return 503;
  if (error.code === "invalid-response") return 502;
  if (error.details.status && error.details.status >= 400 && error.details.status < 500) return error.details.status;
  return 502;
}
