import { NextResponse } from 'next/server'
import {
  getReviewAgentCallbackConfig,
  reconcileReviewAgentSessionCallback,
  verifyReviewAgentCallbackSignature,
} from '@/features/pr-review-agent-session'

export const runtime = 'nodejs'

/**
 * Signed completion callback from the agents-daemon. Fires when a review-agent
 * turn finishes, so the final reply is reconciled into the DB even if no
 * browser is polling. Authenticated solely by the HMAC signature (no Clerk —
 * the caller is the daemon, not a user).
 */
export async function POST(request: Request) {
  const config = getReviewAgentCallbackConfig()
  if (!config) {
    return NextResponse.json(
      { error: 'Review agent callbacks are not configured.' },
      { status: 503 },
    )
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-webhook-signature')

  if (
    !verifyReviewAgentCallbackSignature({
      rawBody,
      secret: config.secret,
      signature,
    })
  ) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  let daemonSessionId: string | null = null
  try {
    const payload = JSON.parse(rawBody) as { id?: unknown }
    if (typeof payload.id === 'string') {
      daemonSessionId = payload.id
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!daemonSessionId) {
    return NextResponse.json(
      { error: 'Callback payload is missing the session id.' },
      { status: 400 },
    )
  }

  try {
    await reconcileReviewAgentSessionCallback(daemonSessionId)
  } catch {
    // Surface a 500 so the daemon retries a transient reconcile failure; a
    // client poll also recovers, so nothing is permanently lost either way.
    return NextResponse.json(
      { error: 'Failed to reconcile the review agent session.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
