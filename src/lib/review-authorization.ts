import "server-only";

import { getPullRequestSnapshotById, type PullRequestSnapshotRow } from "@/lib/db/pull-request-snapshots";
import { createCurrentUserGitHubRestClient } from "@/lib/github/server/clerk-token";
import { GitHubClientError } from "@/lib/github/server/errors";

export type ReviewAuthorizationResult =
  | {
      ok: true;
      snapshot: PullRequestSnapshotRow;
    }
  | {
      ok: false;
      reason: "github-access-required" | "not-found" | "unavailable";
    };

export async function authorizeReviewSnapshotAccess(snapshotId: string): Promise<ReviewAuthorizationResult> {
  const snapshot = await getPullRequestSnapshotById(snapshotId);

  if (!snapshot) {
    return { ok: false, reason: "not-found" };
  }

  try {
    const github = await createCurrentUserGitHubRestClient();
    await github.getRepository({
      owner: snapshot.owner,
      repo: snapshot.repo,
    });

    return { ok: true, snapshot };
  } catch (error) {
    if (error instanceof GitHubClientError) {
      if (
        error.code === "missing_auth" ||
        error.code === "missing_scope" ||
        error.code === "not_found"
      ) {
        return { ok: false, reason: "github-access-required" };
      }
    }

    return { ok: false, reason: "unavailable" };
  }
}
