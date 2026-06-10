import type {
  NormalizedPullRequest,
  NormalizedPullRequestComment,
  NormalizedPullRequestCommit,
  NormalizedPullRequestFile,
  PullRequestFileStatus,
} from '@/entities/github'
import type { GitHubPullRequestRef } from '@/entities/github'

type GitHubUser = {
  login?: string | null
}

export type GitHubPullRequestResponse = {
  base: {
    ref: string
    sha: string
  }
  body?: string | null
  created_at: string
  draft?: boolean
  head: {
    ref: string
    sha: string
  }
  html_url: string
  merged_at?: string | null
  number: number
  state: string
  title: string
  updated_at: string
  user?: GitHubUser | null
}

export type GitHubPullRequestFileResponse = {
  additions: number
  changes: number
  deletions: number
  filename: string
  patch?: string
  previous_filename?: string
  sha?: string
  status: string
}

export type GitHubPullRequestCommitResponse = {
  author?: GitHubUser | null
  commit: {
    author?: {
      date?: string | null
      email?: string | null
      name?: string | null
    } | null
    message: string
  }
  sha: string
}

export type GitHubIssueCommentResponse = {
  body?: string | null
  created_at: string
  html_url?: string | null
  id: number
  updated_at?: string | null
  user?: GitHubUser | null
}

export type GitHubReviewCommentResponse = GitHubIssueCommentResponse & {
  line?: number | null
  original_line?: number | null
  path?: string | null
  position?: number | null
}

export function normalizePullRequestResponse(
  ref: GitHubPullRequestRef,
  pullRequest: GitHubPullRequestResponse,
): NormalizedPullRequest {
  return {
    authorLogin: pullRequest.user?.login ?? null,
    baseRef: pullRequest.base.ref,
    baseSha: pullRequest.base.sha,
    body: pullRequest.body ?? null,
    createdAt: pullRequest.created_at,
    draft: pullRequest.draft ?? false,
    headRef: pullRequest.head.ref,
    headSha: pullRequest.head.sha,
    mergedAt: pullRequest.merged_at ?? null,
    number: pullRequest.number,
    owner: ref.owner,
    repo: ref.repo,
    state: pullRequest.state,
    title: pullRequest.title,
    updatedAt: pullRequest.updated_at,
    url: pullRequest.html_url,
  }
}

export function normalizePullRequestFileResponse(
  file: GitHubPullRequestFileResponse,
): NormalizedPullRequestFile {
  return {
    additions: file.additions,
    blobSha: file.sha ?? null,
    changes: file.changes,
    deletions: file.deletions,
    patch: file.patch ?? null,
    path: file.filename,
    previousPath: file.previous_filename ?? null,
    status: normalizeFileStatus(file.status),
  }
}

export function normalizePullRequestCommitResponse(
  commit: GitHubPullRequestCommitResponse,
): NormalizedPullRequestCommit {
  return {
    authorEmail: commit.commit.author?.email ?? null,
    authorLogin: commit.author?.login ?? null,
    authorName: commit.commit.author?.name ?? null,
    authoredAt: commit.commit.author?.date ?? null,
    message: commit.commit.message,
    sha: commit.sha,
  }
}

export function normalizeIssueCommentResponse(
  comment: GitHubIssueCommentResponse,
): NormalizedPullRequestComment {
  return {
    authorLogin: comment.user?.login ?? null,
    body: comment.body ?? '',
    createdAt: comment.created_at,
    githubId: `issue:${comment.id}`,
    line: null,
    path: null,
    type: 'issue_comment',
    updatedAt: comment.updated_at ?? null,
    url: comment.html_url ?? null,
  }
}

export function normalizeReviewCommentResponse(
  comment: GitHubReviewCommentResponse,
): NormalizedPullRequestComment {
  return {
    authorLogin: comment.user?.login ?? null,
    body: comment.body ?? '',
    createdAt: comment.created_at,
    githubId: `review:${comment.id}`,
    line: comment.line ?? comment.original_line ?? comment.position ?? null,
    path: comment.path ?? null,
    type: 'review_comment',
    updatedAt: comment.updated_at ?? null,
    url: comment.html_url ?? null,
  }
}

export function normalizeFileStatus(status: string): PullRequestFileStatus {
  if (
    status === 'added' ||
    status === 'modified' ||
    status === 'removed' ||
    status === 'renamed' ||
    status === 'changed'
  ) {
    return status
  }

  return 'changed'
}
