import { NextResponse } from "next/server";
import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { deleteRepositoryReviewRule } from "@/lib/db/repository-review-rules";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ ruleId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { ruleId } = await context.params;

  if (!ruleId.trim()) {
    return NextResponse.json({ error: "A repository rule id is required." }, { status: 400 });
  }

  const currentUser = await getCurrentCodewalkUser();

  if (currentUser.status === "misconfigured") {
    return NextResponse.json(
      { error: `Clerk is not configured. Missing: ${currentUser.missingKeys.join(", ")}.` },
      { status: 503 },
    );
  }

  if (currentUser.status === "signed-out") {
    return NextResponse.json({ error: "Sign in to manage repository rules." }, { status: 401 });
  }

  const deleted = await deleteRepositoryReviewRule(ruleId);

  if (!deleted) {
    return NextResponse.json({ error: "Repository rule was not found." }, { status: 404 });
  }

  return NextResponse.json({ rule: deleted, status: "deleted" });
}
