import { NextResponse } from "next/server";
import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { listRepositoryReviewRules, upsertRepositoryReviewRule } from "@/lib/db/repository-review-rules";
import { upsertAuthenticatedUser } from "@/lib/db/users";
import { parseGitHubRepositoryInput } from "@/lib/github/repository-url";

export const runtime = "nodejs";

export async function GET() {
  const currentUser = await getCurrentCodewalkUser();

  if (currentUser.status === "misconfigured") {
    return clerkMisconfiguredResponse(currentUser.missingKeys);
  }

  if (currentUser.status === "signed-out") {
    return signedOutResponse();
  }

  const rules = await listRepositoryReviewRules();

  return NextResponse.json({ rules }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const repositoryInput =
    typeof body === "object" && body && "repository" in body && typeof body.repository === "string"
      ? body.repository
      : null;
  const rule = typeof body === "object" && body && "rule" in body ? body.rule : null;

  if (!repositoryInput) {
    return NextResponse.json({ error: "A repository URL or owner/repo is required." }, { status: 400 });
  }

  if (rule !== "allow" && rule !== "block") {
    return NextResponse.json({ error: 'The rule must be either "allow" or "block".' }, { status: 400 });
  }

  const parsed = parseGitHubRepositoryInput(repositoryInput);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const currentUser = await getCurrentCodewalkUser();

  if (currentUser.status === "misconfigured") {
    return clerkMisconfiguredResponse(currentUser.missingKeys);
  }

  if (currentUser.status === "signed-out") {
    return signedOutResponse();
  }

  const user = await upsertAuthenticatedUser({
    clerkUserId: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name,
  });
  const saved = await upsertRepositoryReviewRule({
    createdByUserId: user.id,
    owner: parsed.repository.owner,
    repo: parsed.repository.repo,
    rule,
  });

  return NextResponse.json({ rule: saved }, { status: 201 });
}

function clerkMisconfiguredResponse(missingKeys: string[]) {
  return NextResponse.json(
    { error: `Clerk is not configured. Missing: ${missingKeys.join(", ")}.` },
    { status: 503 },
  );
}

function signedOutResponse() {
  return NextResponse.json({ error: "Sign in to manage repository rules." }, { status: 401 });
}
