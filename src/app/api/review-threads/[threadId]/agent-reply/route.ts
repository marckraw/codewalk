import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { upsertAuthenticatedUser } from '@/entities/database'
import {
  advancePullRequestReviewAgentReply,
  PullRequestReviewAgentSessionError,
  startPullRequestReviewAgentReply,
} from '@/features/pr-review-agent-session'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ threadId: string }>
}

/**
 * Starts an agent reply. Returns as soon as the question is queued on the
 * daemon — the turn itself is observed by polling GET on this route, so no
 * request ever has to outlive a provider turn (Vercel time limits).
 */
export async function POST(_request: Request, context: RouteContext) {
  const { threadId } = await context.params

  const currentUser = await getCurrentCodewalkUser()
  if (currentUser.status === 'misconfigured') {
    return clerkMisconfiguredResponse(currentUser.missingKeys)
  }
  if (currentUser.status === 'signed-out') {
    return signedOutResponse()
  }

  const user = await upsertAuthenticatedUser({
    clerkUserId: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name,
  })

  try {
    const result = await startPullRequestReviewAgentReply({
      requestedByUserId: user.id,
      threadId,
    })
    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    return errorResponse(error)
  }
}

/** One polling step: advances the turn state machine and returns the thread. */
export async function GET(_request: Request, context: RouteContext) {
  const { threadId } = await context.params

  const currentUser = await getCurrentCodewalkUser()
  if (currentUser.status === 'misconfigured') {
    return clerkMisconfiguredResponse(currentUser.missingKeys)
  }
  if (currentUser.status === 'signed-out') {
    return signedOutResponse()
  }

  try {
    const result = await advancePullRequestReviewAgentReply({ threadId })
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

function errorResponse(error: unknown) {
  if (error instanceof PullRequestReviewAgentSessionError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return NextResponse.json(
    { error: 'The review agent failed to answer.' },
    { status: 500 },
  )
}

function clerkMisconfiguredResponse(missingKeys: string[]) {
  return NextResponse.json(
    { error: `Clerk is not configured. Missing: ${missingKeys.join(', ')}.` },
    { status: 503 },
  )
}

function signedOutResponse() {
  return NextResponse.json(
    { error: 'Sign in to ask the review agent.' },
    { status: 401 },
  )
}
