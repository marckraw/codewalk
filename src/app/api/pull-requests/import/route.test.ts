import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedPullRequestSnapshot } from "@/lib/github/domain";
import { GitHubClientError } from "@/lib/github/server/errors";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  getCurrentCodewalkUser: vi.fn(),
}));

vi.mock("@/lib/db/users", () => ({
  upsertAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/db/pull-request-snapshots", () => ({
  persistPullRequestSnapshot: vi.fn(),
}));

vi.mock("@/lib/github/server/bot-token", () => ({
  createServerGitHubRestClient: vi.fn(),
}));

vi.mock("@/lib/github/server/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/github/server/config")>(
    "@/lib/github/server/config",
  );

  return {
    ...actual,
    getGitHubAutomationConfig: vi.fn(),
  };
});

import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { persistPullRequestSnapshot } from "@/lib/db/pull-request-snapshots";
import { upsertAuthenticatedUser } from "@/lib/db/users";
import { createServerGitHubRestClient } from "@/lib/github/server/bot-token";
import { getGitHubAutomationConfig } from "@/lib/github/server/config";

describe("POST /api/pull-requests/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: "octocat@example.com",
      name: "Octocat",
      status: "authenticated",
      userId: "clerk-user-id",
    });
    vi.mocked(upsertAuthenticatedUser).mockResolvedValue({ id: "db-user-id" } as never);
    vi.mocked(getGitHubAutomationConfig).mockReturnValue({
      allowedOwner: "openai",
      botToken: "gh-bot-token",
      ok: true,
    });
    vi.mocked(createServerGitHubRestClient).mockReturnValue({
      getPullRequestSnapshot: vi.fn().mockResolvedValue(fixtureSnapshot),
    } as never);
    vi.mocked(persistPullRequestSnapshot).mockResolvedValue({
      headSha: "head-sha",
      id: "snapshot-id",
      number: 24,
      owner: "openai",
      repo: "codex",
    } as never);
  });

  it("imports a valid GitHub pull request URL", async () => {
    const response = await POST(jsonRequest({ url: "https://github.com/openai/codex/pull/24" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      counts: {
        comments: 1,
        commits: 1,
        files: 1,
      },
      pullRequest: { number: 24, owner: "openai", repo: "codex" },
      snapshot: {
        headSha: "head-sha",
        id: "snapshot-id",
        number: 24,
        owner: "openai",
        repo: "codex",
      },
      status: "imported",
    });
    expect(persistPullRequestSnapshot).toHaveBeenCalledWith({
      importedByUserId: "db-user-id",
      snapshot: fixtureSnapshot,
    });
    expect(createServerGitHubRestClient).toHaveBeenCalledWith("gh-bot-token");
  });

  it("returns parser errors before touching auth or GitHub", async () => {
    const response = await POST(jsonRequest({ url: "https://gitlab.com/openai/codex/pull/24" }));

    expect(response.status).toBe(400);
    expect(getCurrentCodewalkUser).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({ status: "signed-out" });

    const response = await POST(jsonRequest({ url: "https://github.com/openai/codex/pull/24" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in with GitHub before importing a pull request.",
    });
    expect(getGitHubAutomationConfig).not.toHaveBeenCalled();
  });

  it("maps GitHub client errors to API responses", async () => {
    vi.mocked(createServerGitHubRestClient).mockReturnValue({
      getPullRequestSnapshot: vi.fn().mockRejectedValue(
        new GitHubClientError("not_found", "GitHub could not find this pull request."),
      ),
    } as never);

    const response = await POST(jsonRequest({ url: "https://github.com/openai/codex/pull/24" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "not_found",
      error: "GitHub could not find this pull request.",
    });
  });

  it("limits manual imports to the configured GitHub owner", async () => {
    vi.mocked(getGitHubAutomationConfig).mockReturnValue({
      allowedOwner: "ef-global",
      botToken: "gh-bot-token",
      ok: true,
    });

    const response = await POST(jsonRequest({ url: "https://github.com/openai/codex/pull/24" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Codewalk can only import pull requests from ef-global.",
    });
    expect(createServerGitHubRestClient).not.toHaveBeenCalled();
  });

  it("returns JSON when persistence fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(persistPullRequestSnapshot).mockRejectedValue(new Error("insert failed"));

    const response = await POST(jsonRequest({ url: "https://github.com/openai/codex/pull/24" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "import_failed",
      error: "Pull request import failed unexpectedly. Check Vercel function logs for [codewalk-import-failed].",
    });
    expect(console.error).toHaveBeenCalledWith(
      "[codewalk-import-failed]",
      expect.objectContaining({
        error: "insert failed",
        pullRequest: { number: 24, owner: "openai", repo: "codex" },
      }),
    );
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/pull-requests/import", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

const fixtureSnapshot: NormalizedPullRequestSnapshot = {
  comments: [
    {
      authorLogin: "reviewer",
      body: "Looks good",
      createdAt: "2026-01-04T10:00:00Z",
      githubId: "issue:1",
      line: null,
      path: null,
      type: "issue_comment",
      updatedAt: null,
      url: null,
    },
  ],
  commits: [
    {
      authorEmail: null,
      authorLogin: "octocat",
      authorName: "Octocat",
      authoredAt: "2026-01-03T10:00:00Z",
      message: "Implement importer",
      sha: "commit-sha",
    },
  ],
  files: [
    {
      additions: 2,
      blobSha: "blob-sha",
      changes: 3,
      deletions: 1,
      patch: "@@ -1 +1 @@",
      path: "src/importer.ts",
      previousPath: null,
      status: "modified",
    },
  ],
  pullRequest: {
    authorLogin: "octocat",
    baseRef: "main",
    baseSha: "base-sha",
    body: null,
    createdAt: "2026-01-01T10:00:00Z",
    draft: false,
    headRef: "feature",
    headSha: "head-sha",
    mergedAt: null,
    number: 24,
    owner: "openai",
    repo: "codex",
    state: "open",
    title: "Import pull request snapshots",
    updatedAt: "2026-01-02T10:00:00Z",
    url: "https://github.com/openai/codex/pull/24",
  },
};
