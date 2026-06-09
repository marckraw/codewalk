import { NextResponse } from "next/server";
import {
  CodeReviewGuideGenerationError,
  generateAndPersistCodeReviewGuide,
} from "@/lib/code-review-guide-generation";
import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { upsertAuthenticatedUser } from "@/lib/db/users";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const snapshotId = typeof body === "object" && body && "snapshotId" in body ? body.snapshotId : null;
  const force = typeof body === "object" && body && "force" in body ? body.force : undefined;

  if (typeof snapshotId !== "string" || !snapshotId.trim()) {
    return NextResponse.json({ error: "A pull request snapshot id is required." }, { status: 400 });
  }

  if (force !== undefined && typeof force !== "boolean") {
    return NextResponse.json({ error: "force must be a boolean when provided." }, { status: 400 });
  }

  const currentUser = await getCurrentCodewalkUser();

  if (currentUser.status === "misconfigured") {
    return NextResponse.json(
      { error: `Clerk is not configured. Missing: ${currentUser.missingKeys.join(", ")}.` },
      { status: 503 },
    );
  }

  if (currentUser.status === "signed-out") {
    return NextResponse.json({ error: "Sign in before generating a guided review." }, { status: 401 });
  }

  try {
    const user = await upsertAuthenticatedUser({
      clerkUserId: currentUser.userId,
      email: currentUser.email,
      name: currentUser.name,
    });
    const result = await generateAndPersistCodeReviewGuide({
      force,
      requestedByUserId: user.id,
      snapshotId,
    });

    return NextResponse.json({
      generation: {
        error: result.generation.error,
        guideId: result.generation.guideId,
        id: result.generation.id,
        status: result.generation.status,
      },
      guide: {
        id: result.guide.id,
        status: result.guide.status,
      },
      status: "ready",
    });
  } catch (error) {
    if (error instanceof CodeReviewGuideGenerationError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
    }

    throw error;
  }
}
