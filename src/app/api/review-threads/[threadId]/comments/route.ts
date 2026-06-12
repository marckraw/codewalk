import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import {
  addReviewThreadComment,
  getReviewThread,
  upsertAuthenticatedUser,
} from '@/entities/database'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ threadId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { threadId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'The request body must be JSON.' },
      { status: 400 },
    )
  }

  const text = (body as { body?: unknown }).body
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json(
      { error: 'A non-empty comment body is required.' },
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
      { error: 'Sign in to reply to review threads.' },
      { status: 401 },
    )
  }

  const thread = await getReviewThread(threadId)
  if (!thread) {
    return NextResponse.json(
      { error: 'Review thread was not found.' },
      { status: 404 },
    )
  }

  const user = await upsertAuthenticatedUser({
    clerkUserId: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name,
  })

  const comment = await addReviewThreadComment({
    threadId,
    authorType: 'user',
    authorUserId: user.id,
    body: text,
  })

  return NextResponse.json({ comment }, { status: 201 })
}
