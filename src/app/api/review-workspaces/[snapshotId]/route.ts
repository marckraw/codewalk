import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { getReviewWorkspace } from '@/entities/database'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ snapshotId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { snapshotId } = await context.params

  if (!snapshotId.trim()) {
    return NextResponse.json(
      { error: 'A pull request snapshot id is required.' },
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
      { error: 'Sign in to open this guided review.' },
      { status: 401 },
    )
  }

  const workspace = await getReviewWorkspace(snapshotId)

  if (!workspace) {
    return NextResponse.json(
      { error: 'Review workspace was not found.' },
      { status: 404 },
    )
  }

  return NextResponse.json(workspace, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
