import { NextResponse } from "next/server";
import { checkAgentsDaemonConnection } from "@/entities/agents-daemon";
import { getCurrentCodewalkUser } from "@/entities/auth-server";

export async function GET() {
  const currentUser = await getCurrentCodewalkUser();

  if (currentUser.status === "misconfigured") {
    return NextResponse.json(
      { error: `Clerk is not configured. Missing: ${currentUser.missingKeys.join(", ")}.` },
      { status: 503 },
    );
  }

  if (currentUser.status === "signed-out") {
    return NextResponse.json({ error: "Sign in before checking agents-daemon diagnostics." }, { status: 401 });
  }

  const result = await checkAgentsDaemonConnection();

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
