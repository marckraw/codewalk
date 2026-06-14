import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

export type ReviewAgentCallbackConfig = {
  secret: string
  url: string
}

/**
 * The signed callback the daemon POSTs when a review-agent turn finishes, so
 * the final reply persists even if no browser is polling. Requires the app's
 * public URL (for the daemon to reach us) and a shared secret. Returns null
 * when unconfigured — sessions then fall back to reconcile-on-poll.
 */
export function getReviewAgentCallbackConfig(
  env: Record<string, string | undefined> = process.env,
): ReviewAgentCallbackConfig | null {
  const secret = env.AGENTS_DAEMON_CALLBACK_SECRET?.trim()
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim()

  if (!secret || !appUrl) {
    return null
  }

  const base = appUrl.replace(/\/+$/, '')
  return { secret, url: `${base}/api/review-agent-sessions/callback` }
}

/**
 * Verifies the daemon's `x-webhook-signature` (HMAC SHA-256 of the raw body,
 * `sha256=<hex>`) in constant time. The only thing standing between the public
 * callback endpoint and arbitrary callers, so it must not be skipped.
 */
export function verifyReviewAgentCallbackSignature(input: {
  rawBody: string
  secret: string
  signature: string | null
}): boolean {
  if (!input.signature) {
    return false
  }

  const expected = `sha256=${createHmac('sha256', input.secret)
    .update(input.rawBody)
    .digest('hex')}`
  const provided = Buffer.from(input.signature)
  const computed = Buffer.from(expected)

  if (provided.length !== computed.length) {
    return false
  }

  return timingSafeEqual(provided, computed)
}
