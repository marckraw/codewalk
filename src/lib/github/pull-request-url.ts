export type GitHubPullRequestRef = {
  number: number;
  owner: string;
  repo: string;
};

export type PullRequestUrlParseResult =
  | {
      pullRequest: GitHubPullRequestRef;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

const githubNamePattern = /^[A-Za-z0-9_.-]+$/;

export function parseGitHubPullRequestUrl(input: string): PullRequestUrlParseResult {
  const value = input.trim();

  if (!value) {
    return { error: "Paste a GitHub pull request URL.", ok: false };
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return { error: "Enter a valid URL.", ok: false };
  }

  if (url.protocol !== "https:") {
    return { error: "Use an https:// GitHub pull request URL.", ok: false };
  }

  if (url.hostname.toLowerCase() !== "github.com") {
    return { error: "Only github.com pull request URLs are supported in the MVP.", ok: false };
  }

  const [owner, repo, pullSegment, numberSegment, ...rest] = url.pathname.split("/").filter(Boolean);

  if (!owner || !repo || pullSegment !== "pull" || !numberSegment || rest.length > 0) {
    return { error: "Use a URL like https://github.com/owner/repo/pull/123.", ok: false };
  }

  if (!githubNamePattern.test(owner) || !githubNamePattern.test(repo)) {
    return { error: "The owner or repository name contains unsupported characters.", ok: false };
  }

  if (!/^[1-9]\d*$/.test(numberSegment)) {
    return { error: "Pull request number must be a positive integer.", ok: false };
  }

  return {
    ok: true,
    pullRequest: {
      number: Number(numberSegment),
      owner,
      repo,
    },
  };
}

export function formatPullRequestRef(ref: GitHubPullRequestRef) {
  return `${ref.owner}/${ref.repo}#${ref.number}`;
}
