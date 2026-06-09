import { describe, expect, it, vi } from "vitest";
import { GitHubClientError } from "./errors";
import { GitHubRestClient } from "./rest-client";

vi.mock("server-only", () => ({}));

const ref = { number: 24, owner: "openai", repo: "codex" };

describe("GitHubRestClient", () => {
  it("fetches pull request metadata from the server-side REST endpoint", async () => {
    const { client, requests } = createClient([
      jsonResponse({
        base: { ref: "main", sha: "base-sha" },
        created_at: "2026-01-01T10:00:00Z",
        head: { ref: "feature", sha: "head-sha" },
        html_url: "https://github.com/openai/codex/pull/24",
        number: 24,
        state: "open",
        title: "Import pull request snapshots",
        updated_at: "2026-01-02T10:00:00Z",
        user: { login: "octocat" },
      }),
    ]);

    await expect(client.getPullRequest(ref)).resolves.toMatchObject({
      owner: "openai",
      repo: "codex",
      title: "Import pull request snapshots",
    });

    expect(requests).toMatchObject([
      {
        authorization: "Bearer gh-test-token",
        url: "https://api.github.com/repos/openai/codex/pulls/24",
        version: "2022-11-28",
      },
    ]);
  });

  it("fetches changed files, patches, commits, and both comment feeds", async () => {
    const { client, requests } = createClient([
      jsonResponse([
        {
          additions: 2,
          changes: 3,
          deletions: 1,
          filename: "src/importer.ts",
          patch: "@@ -1 +1 @@",
          sha: "blob-sha",
          status: "modified",
        },
      ]),
      jsonResponse([
        {
          author: { login: "octocat" },
          commit: { author: { date: "2026-01-03T10:00:00Z" }, message: "Implement importer" },
          sha: "commit-sha",
        },
      ]),
      jsonResponse([{ body: "Ship it", created_at: "2026-01-04T10:00:00Z", id: 1 }]),
      jsonResponse([{ body: "Nit", created_at: "2026-01-04T10:00:00Z", id: 2, path: "src/importer.ts" }]),
    ]);

    await expect(client.listPullRequestFiles(ref)).resolves.toHaveLength(1);
    await expect(client.listPullRequestCommits(ref)).resolves.toHaveLength(1);
    await expect(client.listPullRequestComments(ref)).resolves.toMatchObject([
      { githubId: "issue:1", type: "issue_comment" },
      { githubId: "review:2", type: "review_comment" },
    ]);

    expect(requests.map((request) => request.url)).toEqual([
      "https://api.github.com/repos/openai/codex/pulls/24/files?per_page=100",
      "https://api.github.com/repos/openai/codex/pulls/24/commits?per_page=100",
      "https://api.github.com/repos/openai/codex/issues/24/comments?per_page=100",
      "https://api.github.com/repos/openai/codex/pulls/24/comments?per_page=100",
    ]);
  });

  it("follows GitHub pagination links", async () => {
    const { client } = createClient([
      jsonResponse(
        [
          {
            additions: 1,
            changes: 1,
            deletions: 0,
            filename: "first.ts",
            status: "added",
          },
        ],
        {
          headers: {
            link: '<https://api.github.com/repos/openai/codex/pulls/24/files?page=2&per_page=100>; rel="next"',
          },
        },
      ),
      jsonResponse([
        {
          additions: 0,
          changes: 1,
          deletions: 1,
          filename: "second.ts",
          status: "removed",
        },
      ]),
    ]);

    await expect(client.listPullRequestFiles(ref)).resolves.toMatchObject([
      { path: "first.ts" },
      { path: "second.ts" },
    ]);
  });

  it("creates and updates PR issue comments", async () => {
    const { client, requests } = createClient([
      jsonResponse({ body: "Preparing", html_url: "https://github.com/openai/codex/pull/24#issuecomment-1", id: 1 }),
      jsonResponse({ body: "Ready", html_url: "https://github.com/openai/codex/pull/24#issuecomment-1", id: 1 }),
    ]);

    await expect(client.createIssueComment(ref, "Preparing")).resolves.toEqual({
      body: "Preparing",
      htmlUrl: "https://github.com/openai/codex/pull/24#issuecomment-1",
      id: 1,
    });
    await expect(client.updateIssueComment(ref, "1", "Ready")).resolves.toEqual({
      body: "Ready",
      htmlUrl: "https://github.com/openai/codex/pull/24#issuecomment-1",
      id: 1,
    });

    expect(requests).toMatchObject([
      {
        body: JSON.stringify({ body: "Preparing" }),
        method: "POST",
        url: "https://api.github.com/repos/openai/codex/issues/24/comments",
      },
      {
        body: JSON.stringify({ body: "Ready" }),
        method: "PATCH",
        url: "https://api.github.com/repos/openai/codex/issues/comments/1",
      },
    ]);
  });

  it("requires a GitHub token before calling the API", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new GitHubRestClient({ fetcher, token: null });

    await expect(client.getPullRequest(ref)).rejects.toMatchObject({
      code: "missing_auth",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, {}, "missing_auth"],
    [403, { "x-ratelimit-remaining": "0" }, "rate_limited"],
    [403, {}, "missing_scope"],
    [404, {}, "not_found"],
    [500, {}, "github_error"],
  ])("maps GitHub %s responses to app errors", async (status, headers, code) => {
    const { client } = createClient([
      jsonResponse({ message: "GitHub error" }, { headers, status }),
    ]);
    const result = client.getPullRequest(ref);

    await expect(result).rejects.toBeInstanceOf(GitHubClientError);
    await expect(result).rejects.toMatchObject({ code });
  });
});

type RequestRecord = {
  authorization: string | null;
  body: string | null;
  method: string | undefined;
  url: string;
  version: string | null;
};

function createClient(responses: Response[]) {
  const requests: RequestRecord[] = [];
  const queuedResponses = [...responses];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const headers = new Headers(init?.headers);

    requests.push({
      authorization: headers.get("authorization"),
      body: init?.body ? String(init.body) : null,
      method: init?.method,
      url: String(input),
      version: headers.get("x-github-api-version"),
    });

    const response = queuedResponses.shift();

    if (!response) {
      throw new Error("Unexpected GitHub request in test.");
    }

    return response;
  });

  return {
    client: new GitHubRestClient({ fetcher, token: "gh-test-token" }),
    requests,
  };
}

function jsonResponse(
  body: unknown,
  init: ResponseInit & { headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}
