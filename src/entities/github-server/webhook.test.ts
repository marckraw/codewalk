import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  extractGitHubWebhookJson,
  getGitHubWebhookConfig,
  resolveGitHubPullRequestWebhook,
  shouldGenerateGuideForPullRequestWebhookAction,
  verifyGitHubWebhookSignature,
} from './webhook'

describe('extractGitHubWebhookJson', () => {
  const json = JSON.stringify({ action: 'opened' })

  it('returns the body as-is for application/json', () => {
    expect(
      extractGitHubWebhookJson({ body: json, contentType: 'application/json' }),
    ).toBe(json)
  })

  it('defaults to treating the body as JSON when content type is absent', () => {
    expect(extractGitHubWebhookJson({ body: json, contentType: null })).toBe(
      json,
    )
  })

  it('extracts the payload field for application/x-www-form-urlencoded', () => {
    const body = `payload=${encodeURIComponent(json)}`
    expect(
      extractGitHubWebhookJson({
        body,
        contentType: 'application/x-www-form-urlencoded',
      }),
    ).toBe(json)
    expect(
      extractGitHubWebhookJson({
        body,
        contentType: 'application/x-www-form-urlencoded; charset=utf-8',
      }),
    ).toBe(json)
  })

  it('returns null for empty or payload-less bodies', () => {
    expect(
      extractGitHubWebhookJson({
        body: '   ',
        contentType: 'application/json',
      }),
    ).toBeNull()
    expect(
      extractGitHubWebhookJson({
        body: 'other=1',
        contentType: 'application/x-www-form-urlencoded',
      }),
    ).toBeNull()
  })
})

describe('GitHub webhook helpers', () => {
  it('validates GitHub sha256 webhook signatures', () => {
    const payload = JSON.stringify({ action: 'opened' })
    const secret = 'webhook-secret'
    const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`

    expect(
      verifyGitHubWebhookSignature({
        payload,
        secret,
        signatureHeader: signature,
      }),
    ).toBe(true)
    expect(
      verifyGitHubWebhookSignature({
        payload,
        secret,
        signatureHeader: 'sha256=bad',
      }),
    ).toBe(false)
    expect(
      verifyGitHubWebhookSignature({ payload, secret, signatureHeader: null }),
    ).toBe(false)
  })

  it('extracts supported pull request webhook targets', () => {
    expect(
      resolveGitHubPullRequestWebhook({
        event: 'pull_request',
        payload: {
          action: 'opened',
          pull_request: { number: 42 },
          repository: {
            name: 'example',
            owner: { login: 'ef-global' },
          },
        },
      }),
    ).toEqual({
      action: 'opened',
      ok: true,
      pullRequest: {
        number: 42,
        owner: 'ef-global',
        repo: 'example',
      },
    })
  })

  it('extracts lifecycle-only pull request webhook targets', () => {
    expect(
      resolveGitHubPullRequestWebhook({
        event: 'pull_request',
        payload: {
          action: 'closed',
          pull_request: { number: 42 },
          repository: { name: 'example', owner: { login: 'ef-global' } },
        },
      }),
    ).toEqual({
      action: 'closed',
      ok: true,
      pullRequest: {
        number: 42,
        owner: 'ef-global',
        repo: 'example',
      },
    })
  })

  it('classifies which handled pull request webhook actions generate guides', () => {
    expect(shouldGenerateGuideForPullRequestWebhookAction('opened')).toBe(true)
    expect(
      shouldGenerateGuideForPullRequestWebhookAction('ready_for_review'),
    ).toBe(true)
    expect(shouldGenerateGuideForPullRequestWebhookAction('closed')).toBe(false)
    expect(
      shouldGenerateGuideForPullRequestWebhookAction('converted_to_draft'),
    ).toBe(false)
  })

  it('ignores unsupported events and actions', () => {
    expect(
      resolveGitHubPullRequestWebhook({ event: 'push', payload: {} }),
    ).toEqual({
      ok: false,
      reason: 'ignored-event',
    })
    expect(
      resolveGitHubPullRequestWebhook({
        event: 'pull_request',
        payload: {
          action: 'labeled',
          pull_request: { number: 42 },
          repository: { name: 'example', owner: { login: 'ef-global' } },
        },
      }),
    ).toEqual({ ok: false, reason: 'ignored-action' })
  })

  it('requires deployment configuration', () => {
    expect(getGitHubWebhookConfig({})).toMatchObject({
      missingKeys: [
        'GITHUB_WEBHOOK_SECRET',
        'GITHUB_BOT_TOKEN',
        'GITHUB_ALLOWED_OWNER',
      ],
      ok: false,
    })
    expect(
      getGitHubWebhookConfig({
        GITHUB_ALLOWED_OWNER: 'ef-global',
        GITHUB_BOT_TOKEN: 'gh-token',
        GITHUB_WEBHOOK_SECRET: 'secret',
      }),
    ).toEqual({
      allowedOwner: 'ef-global',
      botToken: 'gh-token',
      ok: true,
      secret: 'secret',
    })
  })
})
