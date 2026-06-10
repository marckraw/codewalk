import { describe, expect, it } from 'vitest'
import {
  formatPullRequestRef,
  parseGitHubPullRequestUrl,
} from './pull-request-url'

describe('parseGitHubPullRequestUrl', () => {
  it.each([
    [
      'https://github.com/vercel/next.js/pull/123',
      { owner: 'vercel', repo: 'next.js', number: 123 },
    ],
    [
      ' https://github.com/openai/codex/pull/1 ',
      { owner: 'openai', repo: 'codex', number: 1 },
    ],
    [
      'https://github.com/org-name/repo_name/pull/42?foo=bar#discussion',
      { owner: 'org-name', repo: 'repo_name', number: 42 },
    ],
  ])('parses %s', (url, expected) => {
    expect(parseGitHubPullRequestUrl(url)).toEqual({
      ok: true,
      pullRequest: expected,
    })
  })

  it.each([
    '',
    'not-a-url',
    'http://github.com/org/repo/pull/123',
    'https://gitlab.com/org/repo/pull/123',
    'https://github.com/org/repo/issues/123',
    'https://github.com/org/repo/pull/0',
    'https://github.com/org/repo/pull/abc',
    'https://github.com/org/repo/pull/123/files',
    'https://github.com/org/re po/pull/123',
  ])('rejects %s', (url) => {
    expect(parseGitHubPullRequestUrl(url).ok).toBe(false)
  })

  it('formats a normalized PR reference', () => {
    expect(
      formatPullRequestRef({ owner: 'openai', repo: 'codex', number: 12 }),
    ).toBe('openai/codex#12')
  })
})
