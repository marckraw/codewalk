import "server-only";

import type {
  NormalizedPullRequest,
  NormalizedPullRequestComment,
  NormalizedPullRequestCommit,
  NormalizedPullRequestFile,
  NormalizedPullRequestSnapshot,
} from "@/entities/github";
import type { GitHubPullRequestRef } from "@/entities/github";
import { getGitHubRequestTimeoutMs } from "./config";
import { GitHubClientError, mapGitHubErrorResponse, missingGitHubAuthError } from "./errors";
import {
  type GitHubIssueCommentResponse,
  type GitHubPullRequestCommitResponse,
  type GitHubPullRequestFileResponse,
  type GitHubPullRequestResponse,
  type GitHubReviewCommentResponse,
  normalizeIssueCommentResponse,
  normalizePullRequestCommitResponse,
  normalizePullRequestFileResponse,
  normalizePullRequestResponse,
  normalizeReviewCommentResponse,
} from "./normalizers";

const defaultBaseUrl = "https://api.github.com";
const defaultApiVersion = "2022-11-28";

type Fetcher = typeof fetch;

export type GitHubRestClientOptions = {
  apiVersion?: string;
  baseUrl?: string;
  fetcher?: Fetcher;
  timeoutMs?: number;
  token?: string | null;
};

export type GitHubIssueComment = {
  body: string;
  htmlUrl: string | null;
  id: number;
};

type GitHubRepositoryResponse = {
  full_name?: string;
  id?: number;
};

export class GitHubRestClient {
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;
  private readonly token: string | null;

  constructor(options: GitHubRestClientOptions = {}) {
    this.apiVersion = options.apiVersion ?? defaultApiVersion;
    this.baseUrl = options.baseUrl ?? defaultBaseUrl;
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? getGitHubRequestTimeoutMs();
    this.token = options.token ?? null;
  }

  async getPullRequest(ref: GitHubPullRequestRef): Promise<NormalizedPullRequest> {
    const pullRequest = await this.request<GitHubPullRequestResponse>(pullRequestPath(ref));
    return normalizePullRequestResponse(ref, pullRequest);
  }

  async getRepository(ref: Pick<GitHubPullRequestRef, "owner" | "repo">): Promise<GitHubRepositoryResponse> {
    return this.request<GitHubRepositoryResponse>(repositoryPath(ref));
  }

  async listPullRequestFiles(ref: GitHubPullRequestRef): Promise<NormalizedPullRequestFile[]> {
    const files = await this.requestPaginated<GitHubPullRequestFileResponse>(`${pullRequestPath(ref)}/files`);
    return files.map(normalizePullRequestFileResponse);
  }

  async listPullRequestCommits(ref: GitHubPullRequestRef): Promise<NormalizedPullRequestCommit[]> {
    const commits = await this.requestPaginated<GitHubPullRequestCommitResponse>(`${pullRequestPath(ref)}/commits`);
    return commits.map(normalizePullRequestCommitResponse);
  }

  async listPullRequestComments(ref: GitHubPullRequestRef): Promise<NormalizedPullRequestComment[]> {
    const [issueComments, reviewComments] = await Promise.all([
      this.requestPaginated<GitHubIssueCommentResponse>(issueCommentsPath(ref)),
      this.requestPaginated<GitHubReviewCommentResponse>(`${pullRequestPath(ref)}/comments`),
    ]);

    return [
      ...issueComments.map(normalizeIssueCommentResponse),
      ...reviewComments.map(normalizeReviewCommentResponse),
    ];
  }

  async listIssueComments(ref: GitHubPullRequestRef): Promise<GitHubIssueComment[]> {
    const comments = await this.requestPaginated<GitHubIssueCommentResponse>(issueCommentsPath(ref));
    return comments.map(normalizeIssueComment);
  }

  async createIssueComment(ref: GitHubPullRequestRef, body: string): Promise<GitHubIssueComment> {
    const comment = await this.request<GitHubIssueCommentResponse>(issueCommentsPath(ref), {
      body: { body },
      method: "POST",
    });
    return normalizeIssueComment(comment);
  }

  async updateIssueComment(ref: GitHubPullRequestRef, commentId: string, body: string): Promise<GitHubIssueComment> {
    const comment = await this.request<GitHubIssueCommentResponse>(issueCommentPath(ref, commentId), {
      body: { body },
      method: "PATCH",
    });
    return normalizeIssueComment(comment);
  }

  async getPullRequestSnapshot(ref: GitHubPullRequestRef): Promise<NormalizedPullRequestSnapshot> {
    const [pullRequest, files, commits, comments] = await Promise.all([
      this.getPullRequest(ref),
      this.listPullRequestFiles(ref),
      this.listPullRequestCommits(ref),
      this.listPullRequestComments(ref),
    ]);

    return {
      comments,
      commits,
      files,
      pullRequest,
    };
  }

  private async requestPaginated<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    let nextPath: string | null = withPaginationParams(path);

    while (nextPath) {
      const response = await this.requestRaw(nextPath);
      const body = (await readJson(response)) as unknown;

      if (!response.ok) {
        throw mapGitHubErrorResponse(response, body);
      }

      if (!Array.isArray(body)) {
        throw new Error("GitHub returned an unexpected non-array paginated response.");
      }

      items.push(...(body as T[]));
      nextPath = getNextPagePath(response.headers.get("link"), this.baseUrl);
    }

    return items;
  }

  private async request<T>(path: string, init: { body?: unknown; method?: string } = {}): Promise<T> {
    const response = await this.requestRaw(path, init);
    const body = (await readJson(response)) as unknown;

    if (!response.ok) {
      throw mapGitHubErrorResponse(response, body);
    }

    return body as T;
  }

  private async requestRaw(path: string, init: { body?: unknown; method?: string } = {}) {
    if (!this.token) {
      throw missingGitHubAuthError();
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": this.apiVersion,
    };

    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const timeout = createRequestTimeout(this.timeoutMs);

    try {
      return await this.fetcher(toGitHubUrl(path, this.baseUrl), {
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        headers: {
          ...headers,
        },
        method: init.method,
        signal: timeout.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new GitHubClientError("github_error", `GitHub request timed out after ${this.timeoutMs}ms.`);
      }

      throw error;
    } finally {
      timeout.clear();
    }
  }
}

function createRequestTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`)), timeoutMs);

  return {
    clear: () => clearTimeout(timer),
    signal: controller.signal,
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.message.includes("timed out"));
}

export function pullRequestPath(ref: GitHubPullRequestRef) {
  return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${ref.number}`;
}

function repositoryPath(ref: Pick<GitHubPullRequestRef, "owner" | "repo">) {
  return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
}

function issueCommentsPath(ref: GitHubPullRequestRef) {
  return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}/comments`;
}

function issueCommentPath(ref: GitHubPullRequestRef, commentId: string) {
  return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/comments/${encodeURIComponent(commentId)}`;
}

function normalizeIssueComment(comment: GitHubIssueCommentResponse): GitHubIssueComment {
  return {
    body: comment.body ?? "",
    htmlUrl: comment.html_url ?? null,
    id: comment.id,
  };
}

function toGitHubUrl(path: string, baseUrl: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${baseUrl}${path}`;
}

function withPaginationParams(path: string) {
  const url = new URL(toGitHubUrl(path, defaultBaseUrl));
  url.searchParams.set("per_page", "100");
  return `${url.pathname}${url.search}`;
}

function getNextPagePath(linkHeader: string | null, baseUrl: string) {
  if (!linkHeader) {
    return null;
  }

  const nextLink = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="next"'));

  const href = nextLink?.match(/<([^>]+)>/)?.[1];

  if (!href) {
    return null;
  }

  const url = new URL(href, baseUrl);
  return `${url.pathname}${url.search}`;
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  return JSON.parse(text);
}
