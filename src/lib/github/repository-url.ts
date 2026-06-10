export type GitHubRepositoryRef = {
  owner: string;
  repo: string;
};

export type RepositoryInputParseResult =
  | {
      repository: GitHubRepositoryRef;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

const githubNamePattern = /^[A-Za-z0-9_.-]+$/;

/**
 * Parse a repository reference from user input. Accepts a full GitHub URL
 * (any deep link works, e.g. https://github.com/owner/repo/pull/123) or the
 * owner/repo shorthand.
 */
export function parseGitHubRepositoryInput(input: string): RepositoryInputParseResult {
  const value = input.trim();

  if (!value) {
    return { error: "Paste a GitHub repository URL or owner/repo.", ok: false };
  }

  if (value.includes("://") || value.toLowerCase().startsWith("github.com/")) {
    return parseRepositoryUrl(value.includes("://") ? value : `https://${value}`);
  }

  const [owner, repo, ...rest] = value.split("/").filter(Boolean);

  if (!owner || !repo || rest.length > 0) {
    return { error: "Use a URL like https://github.com/owner/repo or the owner/repo shorthand.", ok: false };
  }

  return buildRepositoryRef(owner, repo);
}

export function formatRepositoryRef(repository: GitHubRepositoryRef) {
  return `${repository.owner}/${repository.repo}`;
}

function parseRepositoryUrl(value: string): RepositoryInputParseResult {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return { error: "Enter a valid URL.", ok: false };
  }

  if (url.protocol !== "https:") {
    return { error: "Use an https:// GitHub repository URL.", ok: false };
  }

  if (url.hostname.toLowerCase() !== "github.com") {
    return { error: "Only github.com repositories are supported.", ok: false };
  }

  const [owner, repo] = url.pathname.split("/").filter(Boolean);

  if (!owner || !repo) {
    return { error: "Use a URL like https://github.com/owner/repo.", ok: false };
  }

  return buildRepositoryRef(owner, repo);
}

function buildRepositoryRef(owner: string, rawRepo: string): RepositoryInputParseResult {
  const repo = rawRepo.replace(/\.git$/, "");

  if (!githubNamePattern.test(owner) || !githubNamePattern.test(repo)) {
    return { error: "The owner or repository name contains unsupported characters.", ok: false };
  }

  return {
    ok: true,
    repository: { owner, repo },
  };
}
