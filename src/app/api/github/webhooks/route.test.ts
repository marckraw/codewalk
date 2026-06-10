import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeReviewGuideGenerationError } from "@/lib/code-review-guide-generation";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

const afterTasks = vi.hoisted(() => [] as Array<() => unknown>);

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();

  return {
    ...actual,
    after: vi.fn((task: () => unknown) => {
      afterTasks.push(task);
    }),
  };
});

vi.mock("@/lib/github/webhook", () => ({
  extractGitHubWebhookJson: (input: { body: string }) => input.body,
  getGitHubWebhookConfig: vi.fn(),
  resolveGitHubPullRequestWebhook: vi.fn(),
  shouldGenerateGuideForPullRequestWebhookAction: vi.fn((action: string) =>
    ["opened", "reopened", "synchronize", "ready_for_review"].includes(action),
  ),
  verifyGitHubWebhookSignature: vi.fn(),
}));

vi.mock("@/lib/github/server/bot-token", () => ({
  createServerGitHubRestClient: vi.fn(),
}));

vi.mock("@/lib/db/pull-request-snapshots", () => ({
  persistPullRequestSnapshot: vi.fn(),
}));

vi.mock("@/lib/db/repository-review-rules", () => ({
  listRepositoryReviewRules: vi.fn(),
}));

vi.mock("@/lib/db/code-review-guide-generations", () => ({
  updateCodeReviewGuideGenerationComment: vi.fn(),
}));

vi.mock("@/lib/code-review-guide-generation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/code-review-guide-generation")>(
    "@/lib/code-review-guide-generation",
  );

  return {
    ...actual,
    generateAndPersistCodeReviewGuide: vi.fn(),
  };
});

import { generateAndPersistCodeReviewGuide } from "@/lib/code-review-guide-generation";
import { updateCodeReviewGuideGenerationComment } from "@/lib/db/code-review-guide-generations";
import { persistPullRequestSnapshot } from "@/lib/db/pull-request-snapshots";
import { listRepositoryReviewRules } from "@/lib/db/repository-review-rules";
import { createServerGitHubRestClient } from "@/lib/github/server/bot-token";
import {
  getGitHubWebhookConfig,
  resolveGitHubPullRequestWebhook,
  shouldGenerateGuideForPullRequestWebhookAction,
  verifyGitHubWebhookSignature,
} from "@/lib/github/webhook";

describe("POST /api/github/webhooks", () => {
  beforeEach(() => {
    afterTasks.length = 0;
    vi.clearAllMocks();
    vi.mocked(getGitHubWebhookConfig).mockReturnValue({
      allowedOwner: "ef-global",
      botToken: "gh-token",
      ok: true,
      secret: "webhook-secret",
    });
    vi.mocked(verifyGitHubWebhookSignature).mockReturnValue(true);
    vi.mocked(listRepositoryReviewRules).mockResolvedValue([]);
    vi.mocked(resolveGitHubPullRequestWebhook).mockReturnValue({
      action: "opened",
      ok: true,
      pullRequest: { number: 42, owner: "ef-global", repo: "example" },
    });
    vi.mocked(createServerGitHubRestClient).mockReturnValue({
      createIssueComment: vi.fn().mockResolvedValue({
        body: "preparing",
        htmlUrl: "https://github.com/ef-global/example/pull/42#issuecomment-1",
        id: 1,
      }),
      getPullRequestSnapshot: vi.fn().mockResolvedValue(fixtureSnapshot),
      listIssueComments: vi.fn().mockResolvedValue([]),
      updateIssueComment: vi.fn().mockResolvedValue({
        body: "ready",
        htmlUrl: "https://github.com/ef-global/example/pull/42#issuecomment-1",
        id: 1,
      }),
    } as never);
    vi.mocked(persistPullRequestSnapshot).mockResolvedValue({
      headSha: "head-sha",
      id: "snapshot-id",
      number: 42,
      owner: "ef-global",
      repo: "example",
    } as never);
    vi.mocked(updateCodeReviewGuideGenerationComment).mockResolvedValue({ githubCommentId: "1" } as never);
    vi.mocked(generateAndPersistCodeReviewGuide).mockImplementation(async (input) => {
      await input.onStarted?.({
        generation: { githubCommentId: null } as never,
        snapshot: { id: "snapshot-id", number: 42, owner: "ef-global", repo: "example" } as never,
      });
      await input.onReady?.({
        generation: { githubCommentId: "1" } as never,
        guide: { id: "guide-id" } as never,
        snapshot: { id: "snapshot-id", number: 42, owner: "ef-global", repo: "example" } as never,
      });

      return {
        generation: {
          guideId: "guide-id",
          id: "generation-id",
          status: "ready",
        },
      } as never;
    });
  });

  it("imports the PR snapshot and queues guide generation for valid PR webhooks", async () => {
    const response = await POST(githubWebhookRequest({ action: "opened" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      comment: {
        id: 1,
        url: "https://github.com/ef-global/example/pull/42#issuecomment-1",
      },
      snapshot: {
        headSha: "head-sha",
        id: "snapshot-id",
        number: 42,
        owner: "ef-global",
        repo: "example",
      },
      status: "queued",
    });
    expect(createServerGitHubRestClient).toHaveBeenCalledWith("gh-token");
    expect(persistPullRequestSnapshot).toHaveBeenCalledWith({
      importedByUserId: null,
      snapshot: fixtureSnapshot,
    });
    expect(generateAndPersistCodeReviewGuide).not.toHaveBeenCalled();
    expect(afterTasks).toHaveLength(1);

    await runAfterTasks();

    expect(generateAndPersistCodeReviewGuide).toHaveBeenCalledWith({
      onFailed: expect.any(Function),
      onReady: expect.any(Function),
      onStarted: expect.any(Function),
      requestedByUserId: null,
      snapshotId: "snapshot-id",
    });
    const github = vi.mocked(createServerGitHubRestClient).mock.results[0]?.value;
    expect(github.createIssueComment).toHaveBeenCalledWith(
      { number: 42, owner: "ef-global", repo: "example" },
      expect.stringContaining("is preparing"),
    );
    expect(github.updateIssueComment).toHaveBeenCalledWith(
      { number: 42, owner: "ef-global", repo: "example" },
      "1",
      expect.stringContaining("is ready"),
    );
    expect(updateCodeReviewGuideGenerationComment).toHaveBeenCalledWith({
      githubCommentId: "1",
      githubCommentUrl: "https://github.com/ef-global/example/pull/42#issuecomment-1",
      snapshotId: "snapshot-id",
    });
  });

  it("rejects invalid signatures", async () => {
    vi.mocked(verifyGitHubWebhookSignature).mockReturnValue(false);

    const response = await POST(githubWebhookRequest({ action: "opened" }));

    expect(response.status).toBe(401);
    expect(createServerGitHubRestClient).not.toHaveBeenCalled();
  });

  it("acknowledges ignored events without importing", async () => {
    vi.mocked(resolveGitHubPullRequestWebhook).mockReturnValue({ ok: false, reason: "ignored-action" });

    const response = await POST(githubWebhookRequest({ action: "closed" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ reason: "ignored-action", status: "ignored" });
    expect(createServerGitHubRestClient).not.toHaveBeenCalled();
  });

  it("ignores repositories outside the allowed owner unless whitelisted", async () => {
    vi.mocked(resolveGitHubPullRequestWebhook).mockReturnValue({
      action: "opened",
      ok: true,
      pullRequest: { number: 7, owner: "other-org", repo: "external" },
    });

    const response = await POST(githubWebhookRequest({ action: "opened" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ reason: "not-allowlisted", status: "ignored" });
    expect(persistPullRequestSnapshot).not.toHaveBeenCalled();
  });

  it("accepts whitelisted repositories outside the allowed owner", async () => {
    vi.mocked(resolveGitHubPullRequestWebhook).mockReturnValue({
      action: "opened",
      ok: true,
      pullRequest: { number: 7, owner: "other-org", repo: "external" },
    });
    vi.mocked(listRepositoryReviewRules).mockResolvedValue([
      { owner: "other-org", repo: "external", rule: "allow" } as never,
    ]);

    const response = await POST(githubWebhookRequest({ action: "opened" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ status: "queued" });
    expect(persistPullRequestSnapshot).toHaveBeenCalled();
  });

  it("ignores blocklisted repositories inside the allowed owner", async () => {
    vi.mocked(listRepositoryReviewRules).mockResolvedValue([
      { owner: "ef-global", repo: "example", rule: "block" } as never,
    ]);

    const response = await POST(githubWebhookRequest({ action: "opened" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ reason: "blocklisted", status: "ignored" });
    expect(persistPullRequestSnapshot).not.toHaveBeenCalled();
  });

  it("refreshes lifecycle-only PR webhooks without queuing guide generation", async () => {
    vi.mocked(resolveGitHubPullRequestWebhook).mockReturnValue({
      action: "closed",
      ok: true,
      pullRequest: { number: 42, owner: "ef-global", repo: "example" },
    });

    const response = await POST(githubWebhookRequest({ action: "closed" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      snapshot: {
        headSha: "head-sha",
        id: "snapshot-id",
        number: 42,
        owner: "ef-global",
        repo: "example",
      },
      status: "refreshed",
    });
    expect(shouldGenerateGuideForPullRequestWebhookAction).toHaveBeenCalledWith("closed");
    expect(persistPullRequestSnapshot).toHaveBeenCalledWith({
      importedByUserId: null,
      snapshot: fixtureSnapshot,
    });
    expect(afterTasks).toHaveLength(0);
    const github = vi.mocked(createServerGitHubRestClient).mock.results[0]?.value;
    expect(github.createIssueComment).not.toHaveBeenCalled();
    expect(generateAndPersistCodeReviewGuide).not.toHaveBeenCalled();
  });

  it("acknowledges generation failures after persisting the snapshot", async () => {
    vi.mocked(generateAndPersistCodeReviewGuide).mockImplementationOnce(async (input) => {
      await input.onStarted?.({
        generation: { githubCommentId: null } as never,
        snapshot: { id: "snapshot-id", number: 42, owner: "ef-global", repo: "example" } as never,
      });
      await input.onFailed?.({
        error: "Could not reach agents-daemon.",
        generation: { githubCommentId: "1" } as never,
        snapshot: { id: "snapshot-id", number: 42, owner: "ef-global", repo: "example" } as never,
      });
      throw new CodeReviewGuideGenerationError("daemon", "Could not reach agents-daemon.", 503);
    });

    const response = await POST(githubWebhookRequest({ action: "opened" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      status: "queued",
    });
    await runAfterTasks();

    const github = vi.mocked(createServerGitHubRestClient).mock.results[0]?.value;
    expect(github.updateIssueComment).toHaveBeenCalledWith(
      { number: 42, owner: "ef-global", repo: "example" },
      "1",
      expect.stringContaining("guided review failed"),
    );
  });
});

async function runAfterTasks() {
  const tasks = [...afterTasks];
  afterTasks.length = 0;

  for (const task of tasks) {
    await task();
  }
}

function githubWebhookRequest(payload: unknown) {
  return new Request("http://localhost/api/github/webhooks", {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      "x-github-event": "pull_request",
      "x-hub-signature-256": "sha256=test",
    },
    method: "POST",
  });
}

const fixtureSnapshot = {
  comments: [],
  commits: [],
  files: [],
  pullRequest: {
    authorLogin: "octocat",
    baseRef: "main",
    baseSha: "base-sha",
    body: null,
    createdAt: "2026-06-09T08:00:00.000Z",
    draft: false,
    headRef: "feature",
    headSha: "head-sha",
    mergedAt: null,
    number: 42,
    owner: "ef-global",
    repo: "example",
    state: "open",
    title: "Add guided review",
    updatedAt: "2026-06-09T08:00:00.000Z",
    url: "https://github.com/ef-global/example/pull/42",
  },
};
