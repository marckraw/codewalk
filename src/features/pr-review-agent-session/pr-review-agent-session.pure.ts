import type { PullRequestSnapshotRow } from '@/entities/database'

export function buildPullRequestReviewAgentInitialPrompt(
  snapshot: Pick<
    PullRequestSnapshotRow,
    'baseRef' | 'headRef' | 'number' | 'owner' | 'repo' | 'title' | 'url'
  >,
) {
  return [
    'You are the Codewalk pull request review assistant.',
    '',
    `Pull request: ${snapshot.owner}/${snapshot.repo}#${snapshot.number}`,
    `Title: ${snapshot.title}`,
    `Branch: ${snapshot.baseRef} -> ${snapshot.headRef}`,
    `URL: ${snapshot.url}`,
    '',
    'Your job is to answer anchored review questions about this PR.',
    'Use the repository checkout to inspect surrounding code before answering.',
    'Wait for specific line-range questions from Codewalk review threads.',
    '',
    'Reply with a short readiness confirmation only.',
  ].join('\n')
}

export function buildPullRequestReviewAgentSessionId(input: {
  nonce: string
  number: number
  owner: string
  repo: string
}) {
  return [
    'codewalk-pr',
    safeSessionIdPart(input.owner),
    safeSessionIdPart(input.repo),
    String(input.number),
    safeSessionIdPart(input.nonce),
  ].join('-')
}

function safeSessionIdPart(value: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'unknown'
}
