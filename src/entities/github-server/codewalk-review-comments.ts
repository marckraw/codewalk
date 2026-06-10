import type { GitHubPullRequestRef } from '@/entities/github'
import { GitHubClientError } from '@/entities/github-server'
import type {
  GitHubIssueComment,
  GitHubRestClient,
} from '@/entities/github-server'

export const CODEWALK_REVIEW_COMMENT_MARKER = '<!-- codewalk-guided-review -->'

export type CodewalkReviewCommentState = 'preparing' | 'ready' | 'failed'

export type CodewalkReviewCommentInput = {
  error?: string | null
  reviewUrl: string
  state: CodewalkReviewCommentState
}

export function buildCodewalkReviewUrl(input: {
  appBaseUrl: string
  snapshotId: string
  view?: 'guide' | 'diff'
}) {
  const baseUrl = normalizeAppBaseUrl(input.appBaseUrl)
  const url = new URL(
    `/review/${encodeURIComponent(input.snapshotId)}`,
    `${baseUrl}/`,
  )

  if (input.view) {
    url.searchParams.set('view', input.view)
  }

  return url.toString()
}

export function getCodewalkAppBaseUrl(
  env: Record<string, string | undefined> = process.env,
) {
  return normalizeAppBaseUrl(env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
}

export function buildCodewalkReviewCommentBody(
  input: CodewalkReviewCommentInput,
) {
  switch (input.state) {
    case 'preparing':
      return [
        CODEWALK_REVIEW_COMMENT_MARKER,
        '### Codewalk guided review is preparing',
        '',
        'Codewalk is generating a guided review for this pull request.',
        '',
        `[Open Codewalk review](${input.reviewUrl})`,
      ].join('\n')
    case 'ready':
      return [
        CODEWALK_REVIEW_COMMENT_MARKER,
        '### Codewalk guided review is ready',
        '',
        'The guided review is ready to inspect.',
        '',
        `[Open Codewalk review](${input.reviewUrl})`,
      ].join('\n')
    case 'failed':
      return [
        CODEWALK_REVIEW_COMMENT_MARKER,
        '### Codewalk guided review failed',
        '',
        safeFailureMessage(input.error),
        '',
        `[Open Codewalk review](${input.reviewUrl})`,
      ].join('\n')
  }
}

export async function upsertCodewalkReviewComment(input: {
  body: string
  existingCommentId: string | null
  github: Pick<
    GitHubRestClient,
    'createIssueComment' | 'listIssueComments' | 'updateIssueComment'
  >
  pullRequest: GitHubPullRequestRef
}): Promise<GitHubIssueComment> {
  if (input.existingCommentId) {
    try {
      return await input.github.updateIssueComment(
        input.pullRequest,
        input.existingCommentId,
        input.body,
      )
    } catch (error) {
      if (!(error instanceof GitHubClientError) || error.code !== 'not_found') {
        throw error
      }
    }
  }

  const existing = await findExistingCodewalkComment(
    input.github,
    input.pullRequest,
  )

  if (existing) {
    return input.github.updateIssueComment(
      input.pullRequest,
      String(existing.id),
      input.body,
    )
  }

  return input.github.createIssueComment(input.pullRequest, input.body)
}

async function findExistingCodewalkComment(
  github: Pick<GitHubRestClient, 'listIssueComments'>,
  pullRequest: GitHubPullRequestRef,
) {
  const comments = await github.listIssueComments(pullRequest)
  return (
    comments.find((comment) =>
      comment.body.includes(CODEWALK_REVIEW_COMMENT_MARKER),
    ) ?? null
  )
}

function normalizeAppBaseUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return 'http://localhost:3000'
  }

  const parsed = new URL(trimmed)
  parsed.hash = ''
  parsed.search = ''
  return parsed.toString().replace(/\/+$/, '')
}

function safeFailureMessage(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return 'Codewalk could not generate the guided review.'
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed
}
