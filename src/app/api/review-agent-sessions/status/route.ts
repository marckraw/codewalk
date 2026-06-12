import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import {
  getPullRequestReviewAgentSessionStatus,
  PullRequestReviewAgentSessionError,
} from '@/features/pr-review-agent-session'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const owner = url.searchParams.get('owner')?.trim() ?? ''
  const repo = url.searchParams.get('repo')?.trim() ?? ''
  const pullRequestNumber = Number(url.searchParams.get('number'))

  if (!owner || !repo || !Number.isInteger(pullRequestNumber)) {
    return NextResponse.json(
      { error: 'owner, repo and number query parameters are required.' },
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
      { error: 'Sign in to read review agent status.' },
      { status: 401 },
    )
  }

  try {
    const status = await getPullRequestReviewAgentSessionStatus({
      owner,
      pullRequestNumber,
      repo,
    })
    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof PullRequestReviewAgentSessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      )
    }

    return NextResponse.json(
      { error: 'Review agent status is unavailable.' },
      { status: 500 },
    )
  }
}
