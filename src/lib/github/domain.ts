import type { GitHubPullRequestRef } from "./pull-request-url";

export type PullRequestFileStatus = "added" | "modified" | "removed" | "renamed" | "changed";

export type NormalizedPullRequest = GitHubPullRequestRef & {
  authorLogin: string | null;
  baseRef: string;
  baseSha: string;
  body: string | null;
  createdAt: string;
  draft: boolean;
  headRef: string;
  headSha: string;
  mergedAt: string | null;
  state: string;
  title: string;
  updatedAt: string;
  url: string;
};

export type NormalizedPullRequestFile = {
  additions: number;
  blobSha: string | null;
  changes: number;
  deletions: number;
  patch: string | null;
  path: string;
  previousPath: string | null;
  status: PullRequestFileStatus;
};

export type NormalizedPullRequestCommit = {
  authorEmail: string | null;
  authorLogin: string | null;
  authorName: string | null;
  authoredAt: string | null;
  message: string;
  sha: string;
};

export type PullRequestCommentType = "issue_comment" | "review_comment";

export type NormalizedPullRequestComment = {
  authorLogin: string | null;
  body: string;
  createdAt: string;
  githubId: string;
  line: number | null;
  path: string | null;
  type: PullRequestCommentType;
  updatedAt: string | null;
  url: string | null;
};

export type NormalizedPullRequestSnapshot = {
  comments: NormalizedPullRequestComment[];
  commits: NormalizedPullRequestCommit[];
  files: NormalizedPullRequestFile[];
  pullRequest: NormalizedPullRequest;
};
