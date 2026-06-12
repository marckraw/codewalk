import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { upsertAuthenticatedUser } from '@/entities/database'
import {
  askPullRequestReviewAgent,
  PullRequestReviewAgentSessionError,
} from '@/features/pr-review-agent-session'

export const runtime = 'nodejs'
// Provider turns regularly take minutes; streaming partials is P8.
export const maxDuration = 300

type RouteContext = {
  params: Promise<{ threadId: string }>
}

export async function POST(_request: Request, context: RouteContext) {
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

  const user = await upsertAuthenticatedUser({
    clerkUserId: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name,
  })

  try {
    const result = await askPullRequestReviewAgent({
      requestedByUserId: user.id,
      threadId,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PullRequestReviewAgentSessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      )
    }

    return NextResponse.json(
      { error: 'The review agent failed to answer.' },
      { status: 500 },
    )
  }
}
