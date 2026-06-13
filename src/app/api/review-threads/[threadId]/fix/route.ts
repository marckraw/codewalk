import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { upsertAuthenticatedUser } from '@/entities/database'
import {
  PullRequestReviewAgentSessionError,
  startPullRequestReviewAgentFix,
} from '@/features/pr-review-agent-session'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ threadId: string }>
}

/**
 * Asks the agent to implement the change discussed in the thread. Returns as
 * soon as the fix turn is queued on the daemon — completion is observed by
 * polling GET on the agent-reply route, like a normal question.
 */
export async function POST(request: Request, context: RouteContext) {
  const { threadId } = await context.params

  const currentUser = await getCurrentCodewalkUser()
  if (currentUser.status === 'misconfigured') {
    return NextResponse.json(
      {
        error: `Clerk is not configured. Missing: ${currentUser.missingKeys.join(', ')}.`,
      },
      { status: 503 },
    )
  }
  if (currentUser.status === 'signed-out') {
    return NextResponse.json(
      { error: 'Sign in to ask the review agent.' },
      { status: 401 },
    )
  }

  let instruction: string | null = null
  try {
    const body = (await request.json()) as { instruction?: unknown }
    if (typeof body.instruction === 'string') {
      instruction = body.instruction
    }
  } catch {
    // An empty or non-JSON body is fine — the fix proceeds from the discussion.
  }

  const user = await upsertAuthenticatedUser({
    clerkUserId: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name,
  })

  try {
    const result = await startPullRequestReviewAgentFix({
      instruction,
      requestedByUserId: user.id,
      threadId,
    })
    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    if (error instanceof PullRequestReviewAgentSessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      )
    }
    return NextResponse.json(
      { error: 'The review agent could not start the fix.' },
      { status: 500 },
    )
  }
}
