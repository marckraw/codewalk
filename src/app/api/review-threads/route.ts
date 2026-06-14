import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import {
  createReviewThread,
  listReviewThreadsForPullRequest,
  upsertAuthenticatedUser,
} from '@/entities/database'
import { parseReviewThreadExtraAnchors } from '@/entities/review-thread'

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
    return clerkMisconfiguredResponse(currentUser.missingKeys)
  }
  if (currentUser.status === 'signed-out') {
    return signedOutResponse()
  }

  const threads = await listReviewThreadsForPullRequest({
    owner,
    repo,
    pullRequestNumber,
  })
  return NextResponse.json(
    { threads },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

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

  const input = body as {
    owner?: unknown
    repo?: unknown
    number?: unknown
    anchorSnapshotId?: unknown
    anchorCommitSha?: unknown
    filePath?: unknown
    side?: unknown
    lineStart?: unknown
    lineEnd?: unknown
    excerpt?: unknown
    extraAnchors?: unknown
    body?: unknown
  }

  if (
    typeof input.owner !== 'string' ||
    !input.owner.trim() ||
    typeof input.repo !== 'string' ||
    !input.repo.trim() ||
    !Number.isInteger(input.number) ||
    typeof input.anchorCommitSha !== 'string' ||
    !input.anchorCommitSha.trim() ||
    typeof input.filePath !== 'string' ||
    !input.filePath.trim() ||
    (input.side !== 'old' && input.side !== 'new') ||
    !Number.isInteger(input.lineStart) ||
    !Number.isInteger(input.lineEnd) ||
    typeof input.excerpt !== 'string' ||
    typeof input.body !== 'string' ||
    !input.body.trim()
  ) {
    return NextResponse.json(
      {
        error:
          'owner, repo, number, anchorCommitSha, filePath, side (old|new), lineStart, lineEnd, excerpt and a non-empty body are required.',
      },
      { status: 400 },
    )
  }

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

  const thread = await createReviewThread({
    owner: input.owner,
    repo: input.repo,
    pullRequestNumber: input.number as number,
    anchorSnapshotId:
      typeof input.anchorSnapshotId === 'string' && input.anchorSnapshotId
        ? input.anchorSnapshotId
        : null,
    anchorCommitSha: input.anchorCommitSha,
    filePath: input.filePath,
    side: input.side,
    lineStart: input.lineStart as number,
    lineEnd: input.lineEnd as number,
    excerpt: input.excerpt,
    extraAnchors: parseReviewThreadExtraAnchors(input.extraAnchors),
    createdByUserId: user.id,
    body: input.body,
  })

  return NextResponse.json({ thread }, { status: 201 })
}

function clerkMisconfiguredResponse(missingKeys: string[]) {
  return NextResponse.json(
    { error: `Clerk is not configured. Missing: ${missingKeys.join(', ')}.` },
    { status: 503 },
  )
}

function signedOutResponse() {
  return NextResponse.json(
    { error: 'Sign in to view review threads.' },
    { status: 401 },
  )
}
