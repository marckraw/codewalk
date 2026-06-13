import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { upsertAuthenticatedUser } from '@/entities/database'
import {
  discardPullRequestReviewAgentFix,
  PullRequestReviewAgentSessionError,
} from '@/features/pr-review-agent-session'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ commentId: string; threadId: string }>
}

/** Discards a proposed fix and asks the agent to drop its workspace commit. */
export async function POST(_request: Request, context: RouteContext) {
  const { commentId, threadId } = await context.params

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
      { error: 'Sign in to discard a fix.' },
      { status: 401 },
    )
  }

  await upsertAuthenticatedUser({
    clerkUserId: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name,
  })

  try {
    const result = await discardPullRequestReviewAgentFix({
      commentId,
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
      { error: 'Discarding the fix failed.' },
      { status: 500 },
    )
  }
}
