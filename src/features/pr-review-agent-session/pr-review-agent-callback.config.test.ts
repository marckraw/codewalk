import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  getReviewAgentCallbackConfig,
  verifyReviewAgentCallbackSignature,
} from './pr-review-agent-callback.config'

vi.mock('server-only', () => ({}))

describe('getReviewAgentCallbackConfig', () => {
  it('builds the callback url and secret when configured', () => {
    expect(
      getReviewAgentCallbackConfig({
        AGENTS_DAEMON_CALLBACK_SECRET: 's3cret',
        NEXT_PUBLIC_APP_URL: 'https://codewalk.example/',
      }),
    ).toEqual({
      secret: 's3cret',
      url: 'https://codewalk.example/api/review-agent-sessions/callback',
    })
  })

  it('returns null when the secret or app url is missing', () => {
    expect(
      getReviewAgentCallbackConfig({ NEXT_PUBLIC_APP_URL: 'https://x' }),
    ).toBeNull()
    expect(
      getReviewAgentCallbackConfig({ AGENTS_DAEMON_CALLBACK_SECRET: 's' }),
    ).toBeNull()
  })
})

describe('verifyReviewAgentCallbackSignature', () => {
  const secret = 's3cret'
  const rawBody = JSON.stringify({ id: 'sess-1', status: 'FINISHED' })
  const valid = `sha256=${createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')}`

  it('accepts a correct signature', () => {
    expect(
      verifyReviewAgentCallbackSignature({ rawBody, secret, signature: valid }),
    ).toBe(true)
  })

  it('rejects wrong, missing, or mismatched signatures', () => {
    expect(
      verifyReviewAgentCallbackSignature({
        rawBody,
        secret,
        signature: 'sha256=deadbeef',
      }),
    ).toBe(false)
    expect(
      verifyReviewAgentCallbackSignature({ rawBody, secret, signature: null }),
    ).toBe(false)
    // Right signature, tampered body → reject.
    expect(
      verifyReviewAgentCallbackSignature({
        rawBody: '{"id":"other"}',
        secret,
        signature: valid,
      }),
    ).toBe(false)
  })
})
