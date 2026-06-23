import { NextResponse } from 'next/server'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import {
  appendReviewThreadAnchors,
  setReviewThreadStatus,
} from '@/entities/database'
import { parseReviewThreadExtraAnchors } from '@/entities/review-thread'

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

  const payload = body as { attachAnchors?: unknown; status?: unknown }
  const isAttach = payload.attachAnchors !== undefined

  // Attaching selections and updating status are validated against different
  // shapes; pick the one the request carries.
  const anchors = isAttach
    ? parseReviewThreadExtraAnchors(payload.attachAnchors)
    : []

  if (isAttach) {
    if (anchors.length === 0) {
      return NextResponse.json(
        { error: 'attachAnchors must include at least one valid selection.' },
        { status: 400 },
      )
    }
  } else if (payload.status !== 'open' && payload.status !== 'resolved') {
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

  const thread = isAttach
    ? await appendReviewThreadAnchors({ anchors, threadId })
    : await setReviewThreadStatus(
        threadId,
        payload.status as 'open' | 'resolved',
      )

  if (!thread) {
    return NextResponse.json(
      { error: 'Review thread was not found.' },
      { status: 404 },
    )
  }

  return NextResponse.json({ thread })
}
