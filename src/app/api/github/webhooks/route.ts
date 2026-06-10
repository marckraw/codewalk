import { after, NextResponse } from "next/server";
import {
  CodeReviewGuideGenerationError,
  generateAndPersistCodeReviewGuide,
} from "@/lib/code-review-guide-generation";
import { updateCodeReviewGuideGenerationComment } from "@/lib/db/code-review-guide-generations";
import { persistPullRequestSnapshot } from "@/lib/db/pull-request-snapshots";
import { listRepositoryReviewRules } from "@/lib/db/repository-review-rules";
import {
  buildCodewalkReviewCommentBody,
  buildCodewalkReviewUrl,
  getCodewalkAppBaseUrl,
  upsertCodewalkReviewComment,
  type CodewalkReviewCommentState,
} from "@/lib/github/codewalk-review-comments";
import { createServerGitHubRestClient } from "@/lib/github/server/bot-token";
import { evaluateRepositoryReviewAccess } from "@/lib/github/repository-review-access";
import { GitHubClientError } from "@/lib/github/server/errors";
import {
  extractGitHubWebhookJson,
  getGitHubWebhookConfig,
  resolveGitHubPullRequestWebhook,
  verifyGitHubWebhookSignature,
} from "@/lib/github/webhook";
import { logCodewalkError, logCodewalkEvent, logCodewalkWarning } from "@/lib/observability";

export const maxDuration = 800;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getGitHubWebhookConfig();

  if (!config.ok) {
    logCodewalkWarning("codewalk.github_webhook.configuration_failed", {
      missingKeys: config.missingKeys,
    });
    return NextResponse.json({ error: config.message, missingKeys: config.missingKeys }, { status: 503 });
  }

  const payloadText = await request.text();
  const signatureIsValid = verifyGitHubWebhookSignature({
    payload: payloadText,
    secret: config.secret,
    signatureHeader: request.headers.get("x-hub-signature-256"),
  });

  if (!signatureIsValid) {
    logCodewalkWarning("codewalk.github_webhook.invalid_signature");
    return NextResponse.json({ error: "Invalid GitHub webhook signature." }, { status: 401 });
  }

  const jsonText = extractGitHubWebhookJson({
    body: payloadText,
    contentType: request.headers.get("content-type"),
  });

  if (jsonText === null) {
    logCodewalkWarning("codewalk.github_webhook.invalid_json");
    return NextResponse.json({ error: "GitHub webhook payload was empty." }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(jsonText);
  } catch {
    logCodewalkWarning("codewalk.github_webhook.invalid_json");
    return NextResponse.json({ error: "GitHub webhook payload must be JSON." }, { status: 400 });
  }

  const resolved = resolveGitHubPullRequestWebhook({
    event: request.headers.get("x-github-event"),
    payload,
  });

  if (!resolved.ok) {
    logCodewalkEvent("codewalk.github_webhook.ignored", {
      event: request.headers.get("x-github-event"),
      reason: resolved.reason,
    });
    return NextResponse.json({ reason: resolved.reason, status: "ignored" }, { status: 202 });
  }

  try {
    const access = evaluateRepositoryReviewAccess({
      allowedOwner: config.allowedOwner,
      owner: resolved.pullRequest.owner,
      repo: resolved.pullRequest.repo,
      rules: await listRepositoryReviewRules(),
    });

    if (!access.allowed) {
      logCodewalkEvent("codewalk.github_webhook.ignored", {
        event: request.headers.get("x-github-event"),
        owner: resolved.pullRequest.owner,
        reason: access.reason,
        repo: resolved.pullRequest.repo,
      });
      return NextResponse.json({ reason: access.reason, status: "ignored" }, { status: 202 });
    }

    logCodewalkEvent("codewalk.github_webhook.accepted", {
      action: resolved.action,
      owner: resolved.pullRequest.owner,
      pullRequestNumber: resolved.pullRequest.number,
      repo: resolved.pullRequest.repo,
    });
    const github = createServerGitHubRestClient(config.botToken);
    const snapshot = await github.getPullRequestSnapshot(resolved.pullRequest);
    const persistedSnapshot = await persistPullRequestSnapshot({
      importedByUserId: null,
      snapshot,
    });
    logCodewalkEvent("codewalk.github_webhook.snapshot_persisted", {
      headSha: persistedSnapshot.headSha,
      owner: persistedSnapshot.owner,
      pullRequestNumber: persistedSnapshot.number,
      repo: persistedSnapshot.repo,
      snapshotId: persistedSnapshot.id,
    });

    const preparingComment = await postReviewComment({
      existingCommentId: null,
      github,
      persistGenerationComment: false,
      snapshot: persistedSnapshot,
      state: "preparing",
    });

    after(async () => {
      await generatePersistedSnapshotGuide({
        github,
        preparingCommentId: String(preparingComment.id),
        snapshot: persistedSnapshot,
      });
    });

    return NextResponse.json(
      {
        comment: {
          id: preparingComment.id,
          url: preparingComment.htmlUrl,
        },
        snapshot: {
          headSha: persistedSnapshot.headSha,
          id: persistedSnapshot.id,
          number: persistedSnapshot.number,
          owner: persistedSnapshot.owner,
          repo: persistedSnapshot.repo,
        },
        status: "queued",
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof GitHubClientError) {
      logCodewalkError("codewalk.github_webhook.github_failed", {
        code: error.code,
        error,
        message: error.message,
        pullRequestNumber: resolved.pullRequest.number,
        repo: resolved.pullRequest.repo,
      });
      return NextResponse.json({ code: error.code, error: error.message }, { status: statusForGitHubError(error) });
    }

    logCodewalkError("codewalk.github_webhook.unexpected_failed", {
      error,
      pullRequestNumber: resolved.pullRequest.number,
      repo: resolved.pullRequest.repo,
    });
    throw error;
  }
}

async function generatePersistedSnapshotGuide(input: {
  github: ReturnType<typeof createServerGitHubRestClient>;
  preparingCommentId: string;
  snapshot: {
    headSha: string;
    id: string;
    number: number;
    owner: string;
    repo: string;
  };
}) {
  try {
    const result = await generateAndPersistCodeReviewGuide({
      onFailed: async ({ error, generation, snapshot }) => {
        await postReviewComment({
          error,
          existingCommentId: generation.githubCommentId ?? input.preparingCommentId,
          github: input.github,
          snapshot,
          state: "failed",
        });
      },
      onReady: async ({ generation, snapshot }) => {
        await postReviewComment({
          existingCommentId: generation.githubCommentId ?? input.preparingCommentId,
          github: input.github,
          snapshot,
          state: "ready",
        });
      },
      onStarted: async ({ generation, snapshot }) => {
        await postReviewComment({
          existingCommentId: generation.githubCommentId ?? input.preparingCommentId,
          github: input.github,
          snapshot,
          state: "preparing",
        });
      },
      requestedByUserId: null,
      snapshotId: input.snapshot.id,
    });

    logCodewalkEvent("codewalk.github_webhook.generation_completed", {
      generationId: result.generation.id,
      guideId: result.generation.guideId,
      owner: input.snapshot.owner,
      pullRequestNumber: input.snapshot.number,
      repo: input.snapshot.repo,
      snapshotId: input.snapshot.id,
      status: result.generation.status,
    });
  } catch (error) {
    if (error instanceof CodeReviewGuideGenerationError) {
      logCodewalkWarning("codewalk.github_webhook.generation_failed", {
        code: error.code,
        message: error.message,
        owner: input.snapshot.owner,
        pullRequestNumber: input.snapshot.number,
        repo: input.snapshot.repo,
        snapshotId: input.snapshot.id,
      });
      return;
    }

    logCodewalkError("codewalk.github_webhook.generation_unexpected_failed", {
      error,
      owner: input.snapshot.owner,
      pullRequestNumber: input.snapshot.number,
      repo: input.snapshot.repo,
      snapshotId: input.snapshot.id,
    });
  }
}

function statusForGitHubError(error: GitHubClientError) {
  if (error.code === "missing_auth") return 401;
  if (error.code === "missing_scope") return 403;
  if (error.code === "not_found") return 404;
  if (error.code === "rate_limited") return 429;
  return 502;
}

async function postReviewComment(input: {
  error?: string | null;
  existingCommentId: string | null;
  github: ReturnType<typeof createServerGitHubRestClient>;
  persistGenerationComment?: boolean;
  snapshot: {
    id: string;
    number: number;
    owner: string;
    repo: string;
  };
  state: CodewalkReviewCommentState;
}) {
  const reviewUrl = buildCodewalkReviewUrl({
    appBaseUrl: getCodewalkAppBaseUrl(),
    snapshotId: input.snapshot.id,
    view: "guide",
  });
  const comment = await upsertCodewalkReviewComment({
    body: buildCodewalkReviewCommentBody({
      error: input.error,
      reviewUrl,
      state: input.state,
    }),
    existingCommentId: input.existingCommentId,
    github: input.github,
    pullRequest: {
      number: input.snapshot.number,
      owner: input.snapshot.owner,
      repo: input.snapshot.repo,
    },
  });

  if (input.persistGenerationComment ?? true) {
    await updateCodeReviewGuideGenerationComment({
      githubCommentId: String(comment.id),
      githubCommentUrl: comment.htmlUrl,
      snapshotId: input.snapshot.id,
    });
  }
  logCodewalkEvent("codewalk.github_webhook.comment_upserted", {
    commentId: comment.id,
    owner: input.snapshot.owner,
    pullRequestNumber: input.snapshot.number,
    repo: input.snapshot.repo,
    snapshotId: input.snapshot.id,
    state: input.state,
  });

  return comment;
}
