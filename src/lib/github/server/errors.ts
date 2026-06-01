export type GitHubClientErrorCode =
  | "github_error"
  | "missing_auth"
  | "missing_scope"
  | "not_found"
  | "rate_limited";

export type GitHubClientErrorOptions = {
  body?: unknown;
  documentationUrl?: string;
  retryAfterSeconds?: number;
  status?: number;
};

export class GitHubClientError extends Error {
  readonly body?: unknown;
  readonly code: GitHubClientErrorCode;
  readonly documentationUrl?: string;
  readonly retryAfterSeconds?: number;
  readonly status?: number;

  constructor(code: GitHubClientErrorCode, message: string, options: GitHubClientErrorOptions = {}) {
    super(message);
    this.name = "GitHubClientError";
    this.code = code;
    this.status = options.status;
    this.body = options.body;
    this.documentationUrl = options.documentationUrl;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

type GitHubErrorBody = {
  documentation_url?: unknown;
  message?: unknown;
};

export function missingGitHubAuthError() {
  return new GitHubClientError(
    "missing_auth",
    "Connect GitHub before importing a pull request.",
  );
}

export function missingGitHubScopeError() {
  return new GitHubClientError(
    "missing_scope",
    "GitHub did not provide an access token with repository read access.",
  );
}

export function mapGitHubErrorResponse(response: Response, body: unknown) {
  const parsedBody = isGitHubErrorBody(body) ? body : null;
  const message = typeof parsedBody?.message === "string" ? parsedBody.message : null;
  const documentationUrl =
    typeof parsedBody?.documentation_url === "string" ? parsedBody.documentation_url : undefined;
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("retry-after"));

  if (response.status === 401) {
    return new GitHubClientError("missing_auth", "GitHub rejected the access token. Sign in with GitHub again.", {
      body,
      documentationUrl,
      status: response.status,
    });
  }

  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    return new GitHubClientError("rate_limited", "GitHub rate limit reached. Try again after the reset window.", {
      body,
      documentationUrl,
      retryAfterSeconds,
      status: response.status,
    });
  }

  if (response.status === 403) {
    return new GitHubClientError(
      "missing_scope",
      message ?? "GitHub denied access. The connected account may need repository read scope.",
      { body, documentationUrl, status: response.status },
    );
  }

  if (response.status === 404) {
    return new GitHubClientError(
      "not_found",
      "GitHub could not find this pull request, or the connected account cannot access the repository.",
      { body, documentationUrl, status: response.status },
    );
  }

  return new GitHubClientError("github_error", message ?? "GitHub returned an unexpected error.", {
    body,
    documentationUrl,
    status: response.status,
  });
}

function isGitHubErrorBody(value: unknown): value is GitHubErrorBody {
  return typeof value === "object" && value !== null;
}

function parseRetryAfterSeconds(value: string | null) {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : undefined;
}
