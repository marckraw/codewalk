import { NextResponse } from "next/server";
import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { getDeploymentDiagnostics } from "@/lib/deployment/diagnostics";

export const runtime = "nodejs";

export async function GET() {
  const currentUser = await getCurrentCodewalkUser();

  if (currentUser.status === "misconfigured") {
    return NextResponse.json(
      { error: `Clerk is not configured. Missing: ${currentUser.missingKeys.join(", ")}.` },
      { status: 503 },
    );
  }

  if (currentUser.status === "signed-out") {
    return NextResponse.json({ error: "Sign in before checking deployment diagnostics." }, { status: 401 });
  }

  const diagnostics = getDeploymentDiagnostics();

  return NextResponse.json(diagnostics, { status: diagnostics.ok ? 200 : 503 });
}
