import { createHmac, timingSafeEqual } from 'node:crypto'
import type { GitHubPullRequestRef } from '@/entities/github'

export type GitHubWebhookConfig =
  | {
      allowedOwner: string
      botToken: string
      ok: true
      secret: string
    }
  | {
      message: string
      missingKeys: string[]
      ok: false
    }

export type GitHubPullRequestWebhookAction =
  | 'closed'
  | 'converted_to_draft'
  | 'edited'
  | 'opened'
  | 'ready_for_review'
  | 'reopened'
  | 'synchronize'

export type GitHubPullRequestWebhookResolution =
  | {
      action: GitHubPullRequestWebhookAction
      pullRequest: GitHubPullRequestRef
      ok: true
    }
  | {
      ok: false
      reason: 'ignored-action' | 'ignored-event' | 'invalid-payload'
    }

export function getGitHubWebhookConfig(
  env: Record<string, string | undefined> = process.env,
): GitHubWebhookConfig {
  const secret = env.GITHUB_WEBHOOK_SECRET?.trim() ?? ''
  const botToken = env.GITHUB_BOT_TOKEN?.trim() ?? ''
  const allowedOwner = env.GITHUB_ALLOWED_OWNER?.trim() ?? ''
  const missingKeys = [
    secret ? null : 'GITHUB_WEBHOOK_SECRET',
    botToken ? null : 'GITHUB_BOT_TOKEN',
    allowedOwner ? null : 'GITHUB_ALLOWED_OWNER',
  ].filter((key): key is string => Boolean(key))

  if (missingKeys.length > 0) {
    return {
      message: `GitHub webhook configuration is missing: ${missingKeys.join(', ')}.`,
      missingKeys,
      ok: false,
    }
  }

  return {
    allowedOwner,
    botToken,
    ok: true,
    secret,
  }
}

/**
 * Resolve the JSON payload text from a webhook request body, supporting both of
 * GitHub's content types: `application/json` (body is the JSON) and
 * `application/x-www-form-urlencoded` (JSON lives in the `payload` field).
 * Returns null when no payload is present. The signature must be verified
 * against the raw body separately, before calling this.
 */
export function extractGitHubWebhookJson(input: {
  body: string
  contentType: string | null
}): string | null {
  const contentType = input.contentType?.toLowerCase() ?? ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const payload = new URLSearchParams(input.body).get('payload')
    return payload && payload.trim() ? payload : null
  }

  return input.body.trim() ? input.body : null
}

export function verifyGitHubWebhookSignature(input: {
  payload: string
  secret: string
  signatureHeader: string | null
}) {
  const header = input.signatureHeader?.trim() ?? ''

  if (!header.startsWith('sha256=')) {
    return false
  }

  const expected = `sha256=${createHmac('sha256', input.secret).update(input.payload).digest('hex')}`
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(header)

  if (expectedBuffer.byteLength !== actualBuffer.byteLength) {
    return false
  }

  return timingSafeEqual(expectedBuffer, actualBuffer)
}

export function resolveGitHubPullRequestWebhook(input: {
  event: string | null
  payload: unknown
}): GitHubPullRequestWebhookResolution {
  if (input.event !== 'pull_request') {
    return { ok: false, reason: 'ignored-event' }
  }

  const payload = asRecord(input.payload)
  const action = typeof payload?.action === 'string' ? payload.action : null

  if (!isHandledPullRequestAction(action)) {
    return { ok: false, reason: 'ignored-action' }
  }

  const repository = asRecord(payload?.repository)
  const owner = asRecord(repository?.owner)
  const pullRequest = asRecord(payload?.pull_request)
  const repoOwner = typeof owner?.login === 'string' ? owner.login : null
  const repoName = typeof repository?.name === 'string' ? repository.name : null
  const number =
    typeof pullRequest?.number === 'number' ? pullRequest.number : null

  if (
    !repoOwner ||
    !repoName ||
    !number ||
    !Number.isInteger(number) ||
    number < 1
  ) {
    return { ok: false, reason: 'invalid-payload' }
  }

  return {
    action,
    ok: true,
    pullRequest: {
      number,
      owner: repoOwner,
      repo: repoName,
    },
  }
}

function isHandledPullRequestAction(
  value: string | null,
): value is GitHubPullRequestWebhookAction {
  return (
    value === 'closed' ||
    value === 'converted_to_draft' ||
    value === 'edited' ||
    value === 'opened' ||
    value === 'ready_for_review' ||
    value === 'reopened' ||
    value === 'synchronize'
  )
}

export function shouldGenerateGuideForPullRequestWebhookAction(
  action: GitHubPullRequestWebhookAction,
) {
  return (
    action === 'opened' ||
    action === 'reopened' ||
    action === 'synchronize' ||
    action === 'ready_for_review'
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return null
}
