import { NextResponse } from "next/server";
import {
  CodeReviewGuideGenerationError,
  generateAndPersistCodeReviewGuide,
} from "@/lib/code-review-guide-generation";
import { persistPullRequestSnapshot } from "@/lib/db/pull-request-snapshots";
import { createServerGitHubRestClient } from "@/lib/github/server/bot-token";
import { GitHubClientError } from "@/lib/github/server/errors";
import {
  getGitHubWebhookConfig,
  resolveGitHubPullRequestWebhook,
  verifyGitHubWebhookSignature,
} from "@/lib/github/webhook";

export async function POST(request: Request) {
  const config = getGitHubWebhookConfig();

  if (!config.ok) {
    return NextResponse.json({ error: config.message, missingKeys: config.missingKeys }, { status: 503 });
  }

  const payloadText = await request.text();
  const signatureIsValid = verifyGitHubWebhookSignature({
    payload: payloadText,
    secret: config.secret,
    signatureHeader: request.headers.get("x-hub-signature-256"),
  });

  if (!signatureIsValid) {
    return NextResponse.json({ error: "Invalid GitHub webhook signature." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(payloadText);
  } catch {
    return NextResponse.json({ error: "GitHub webhook payload must be JSON." }, { status: 400 });
  }

  const resolved = resolveGitHubPullRequestWebhook({
    allowedOwner: config.allowedOwner,
    event: request.headers.get("x-github-event"),
    payload,
  });

  if (!resolved.ok) {
    return NextResponse.json({ reason: resolved.reason, status: "ignored" }, { status: 202 });
  }

  try {
    const github = createServerGitHubRestClient(config.botToken);
    const snapshot = await github.getPullRequestSnapshot(resolved.pullRequest);
    const persistedSnapshot = await persistPullRequestSnapshot({
      importedByUserId: null,
      snapshot,
    });

    try {
      const result = await generateAndPersistCodeReviewGuide({
        requestedByUserId: null,
        snapshotId: persistedSnapshot.id,
      });

      return NextResponse.json({
        generation: {
          guideId: result.generation.guideId,
          id: result.generation.id,
          status: result.generation.status,
        },
        snapshot: {
          headSha: persistedSnapshot.headSha,
          id: persistedSnapshot.id,
          number: persistedSnapshot.number,
          owner: persistedSnapshot.owner,
          repo: persistedSnapshot.repo,
        },
        status: "generated",
      });
    } catch (error) {
      if (error instanceof CodeReviewGuideGenerationError) {
        return NextResponse.json(
          {
            code: error.code,
            error: error.message,
            snapshot: {
              headSha: persistedSnapshot.headSha,
              id: persistedSnapshot.id,
              number: persistedSnapshot.number,
              owner: persistedSnapshot.owner,
              repo: persistedSnapshot.repo,
            },
            status: "generation_failed",
          },
          { status: 202 },
        );
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof GitHubClientError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: statusForGitHubError(error) });
    }

    throw error;
  }
}

function statusForGitHubError(error: GitHubClientError) {
  if (error.code === "missing_auth") return 401;
  if (error.code === "missing_scope") return 403;
  if (error.code === "not_found") return 404;
  if (error.code === "rate_limited") return 429;
  return 502;
}
