import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { setReviewThreadStatus } from '@/entities/database'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ threadId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const status = (body as { status?: unknown }).status
  if (status !== 'open' && status !== 'resolved') {
    return NextResponse.json(
      { error: 'status must be "open" or "resolved".' },
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
      { error: 'Sign in to update review threads.' },
      { status: 401 },
    )
  }

  const thread = await setReviewThreadStatus(threadId, status)
  if (!thread) {
    return NextResponse.json(
      { error: 'Review thread was not found.' },
      { status: 404 },
    )
  }

  return NextResponse.json({ thread })
}
