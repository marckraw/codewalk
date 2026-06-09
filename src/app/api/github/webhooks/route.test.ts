import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeReviewGuideGenerationError } from "@/lib/code-review-guide-generation";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/github/webhook", () => ({
  getGitHubWebhookConfig: vi.fn(),
  resolveGitHubPullRequestWebhook: vi.fn(),
  verifyGitHubWebhookSignature: vi.fn(),
}));

vi.mock("@/lib/github/server/bot-token", () => ({
  createServerGitHubRestClient: vi.fn(),
}));

vi.mock("@/lib/db/pull-request-snapshots", () => ({
  persistPullRequestSnapshot: vi.fn(),
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
import { persistPullRequestSnapshot } from "@/lib/db/pull-request-snapshots";
import { createServerGitHubRestClient } from "@/lib/github/server/bot-token";
import {
  getGitHubWebhookConfig,
  resolveGitHubPullRequestWebhook,
  verifyGitHubWebhookSignature,
} from "@/lib/github/webhook";

describe("POST /api/github/webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGitHubWebhookConfig).mockReturnValue({
      allowedOwner: "ef-global",
      botToken: "gh-token",
      ok: true,
      secret: "webhook-secret",
    });
    vi.mocked(verifyGitHubWebhookSignature).mockReturnValue(true);
    vi.mocked(resolveGitHubPullRequestWebhook).mockReturnValue({
      action: "opened",
      ok: true,
      pullRequest: { number: 42, owner: "ef-global", repo: "example" },
    });
    vi.mocked(createServerGitHubRestClient).mockReturnValue({
      getPullRequestSnapshot: vi.fn().mockResolvedValue(fixtureSnapshot),
    } as never);
    vi.mocked(persistPullRequestSnapshot).mockResolvedValue({
      headSha: "head-sha",
      id: "snapshot-id",
      number: 42,
      owner: "ef-global",
      repo: "example",
    } as never);
    vi.mocked(generateAndPersistCodeReviewGuide).mockResolvedValue({
      generation: {
        guideId: "guide-id",
        id: "generation-id",
        status: "ready",
      },
    } as never);
  });

  it("imports the PR snapshot and triggers guide generation for valid PR webhooks", async () => {
    const response = await POST(githubWebhookRequest({ action: "opened" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      generation: {
        guideId: "guide-id",
        id: "generation-id",
        status: "ready",
      },
      snapshot: {
        headSha: "head-sha",
        id: "snapshot-id",
        number: 42,
        owner: "ef-global",
        repo: "example",
      },
      status: "generated",
    });
    expect(createServerGitHubRestClient).toHaveBeenCalledWith("gh-token");
    expect(persistPullRequestSnapshot).toHaveBeenCalledWith({
      importedByUserId: null,
      snapshot: fixtureSnapshot,
    });
    expect(generateAndPersistCodeReviewGuide).toHaveBeenCalledWith({
      requestedByUserId: null,
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

  it("acknowledges generation failures after persisting the snapshot", async () => {
    vi.mocked(generateAndPersistCodeReviewGuide).mockRejectedValue(
      new CodeReviewGuideGenerationError("daemon", "Could not reach agents-daemon.", 503),
    );

    const response = await POST(githubWebhookRequest({ action: "opened" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      code: "daemon",
      status: "generation_failed",
    });
  });
});

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
