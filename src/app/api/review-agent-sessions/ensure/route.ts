import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { upsertAuthenticatedUser } from '@/entities/database'
import {
  ensurePullRequestReviewAgentSession,
  PullRequestReviewAgentSessionError,
} from '@/features/pr-review-agent-session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'The request body must be JSON.' },
      { status: 400 },
    )
  }

  const snapshotId = (body as { snapshotId?: unknown }).snapshotId

  if (typeof snapshotId !== 'string' || !snapshotId.trim()) {
    return NextResponse.json(
      { error: 'snapshotId is required.' },
      { status: 400 },
    )
  }

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
      { error: 'Sign in to start review agent sessions.' },
      { status: 401 },
    )
  }

  const user = await upsertAuthenticatedUser({
    clerkUserId: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name,
  })

  try {
    const result = await ensurePullRequestReviewAgentSession({
      requestedByUserId: user.id,
      snapshotId,
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
      { error: 'Review agent session failed.' },
      { status: 500 },
    )
  }
}
