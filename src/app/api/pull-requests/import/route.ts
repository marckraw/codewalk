import { NextResponse } from "next/server";
import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { persistPullRequestSnapshot } from "@/lib/db/pull-request-snapshots";
import { upsertAuthenticatedUser } from "@/lib/db/users";
import { parseGitHubPullRequestUrl } from "@/lib/github/pull-request-url";
import { createCurrentUserGitHubRestClient } from "@/lib/github/server/clerk-token";
import { GitHubClientError } from "@/lib/github/server/errors";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const url = typeof body === "object" && body && "url" in body ? body.url : null;

  if (typeof url !== "string") {
    return NextResponse.json({ error: "A pull request URL is required." }, { status: 400 });
  }

  const parsed = parseGitHubPullRequestUrl(url);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const currentUser = await getCurrentCodewalkUser();

  if (currentUser.status === "misconfigured") {
    return NextResponse.json(
      { error: `Clerk is not configured. Missing: ${currentUser.missingKeys.join(", ")}.` },
      { status: 503 },
    );
  }

  if (currentUser.status === "signed-out") {
    return NextResponse.json({ error: "Sign in with GitHub before importing a pull request." }, { status: 401 });
  }

  try {
    const user = await upsertAuthenticatedUser({
      clerkUserId: currentUser.userId,
      email: currentUser.email,
      name: currentUser.name,
    });
    const github = await createCurrentUserGitHubRestClient();
    const snapshot = await github.getPullRequestSnapshot(parsed.pullRequest);
    const persistedSnapshot = await persistPullRequestSnapshot({
      importedByUserId: user.id,
      snapshot,
    });

    return NextResponse.json({
      counts: {
        comments: snapshot.comments.length,
        commits: snapshot.commits.length,
        files: snapshot.files.length,
      },
      pullRequest: parsed.pullRequest,
      snapshot: {
        headSha: persistedSnapshot.headSha,
        id: persistedSnapshot.id,
        number: persistedSnapshot.number,
        owner: persistedSnapshot.owner,
        repo: persistedSnapshot.repo,
      },
      status: "imported",
    });
  } catch (error) {
    if (error instanceof GitHubClientError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: statusForGitHubError(error) });
    }

    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    throw error;
  }
}

function statusForGitHubError(error: GitHubClientError) {
  if (error.code === "missing_auth") {
    return 401;
  }

  if (error.code === "missing_scope") {
    return 403;
  }

  if (error.code === "not_found") {
    return 404;
  }

  if (error.code === "rate_limited") {
    return 429;
  }

  return 502;
}
