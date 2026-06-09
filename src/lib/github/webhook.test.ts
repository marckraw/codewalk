import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getGitHubWebhookConfig,
  resolveGitHubPullRequestWebhook,
  verifyGitHubWebhookSignature,
} from "./webhook";

describe("GitHub webhook helpers", () => {
  it("validates GitHub sha256 webhook signatures", () => {
    const payload = JSON.stringify({ action: "opened" });
    const secret = "webhook-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

    expect(verifyGitHubWebhookSignature({ payload, secret, signatureHeader: signature })).toBe(true);
    expect(verifyGitHubWebhookSignature({ payload, secret, signatureHeader: "sha256=bad" })).toBe(false);
    expect(verifyGitHubWebhookSignature({ payload, secret, signatureHeader: null })).toBe(false);
  });

  it("extracts supported pull request webhook targets inside the allowed owner", () => {
    expect(
      resolveGitHubPullRequestWebhook({
        allowedOwner: "ef-global",
        event: "pull_request",
        payload: {
          action: "opened",
          pull_request: { number: 42 },
          repository: {
            name: "example",
            owner: { login: "ef-global" },
          },
        },
      }),
    ).toEqual({
      action: "opened",
      ok: true,
      pullRequest: {
        number: 42,
        owner: "ef-global",
        repo: "example",
      },
    });
  });

  it("ignores unsupported events, actions, and owners", () => {
    expect(resolveGitHubPullRequestWebhook({ allowedOwner: "ef-global", event: "push", payload: {} })).toEqual({
      ok: false,
      reason: "ignored-event",
    });
    expect(
      resolveGitHubPullRequestWebhook({
        allowedOwner: "ef-global",
        event: "pull_request",
        payload: {
          action: "closed",
          pull_request: { number: 42 },
          repository: { name: "example", owner: { login: "ef-global" } },
        },
      }),
    ).toEqual({ ok: false, reason: "ignored-action" });
    expect(
      resolveGitHubPullRequestWebhook({
        allowedOwner: "ef-global",
        event: "pull_request",
        payload: {
          action: "opened",
          pull_request: { number: 42 },
          repository: { name: "example", owner: { login: "other-org" } },
        },
      }),
    ).toEqual({ ok: false, reason: "outside-allowed-owner" });
  });

  it("requires deployment configuration", () => {
    expect(getGitHubWebhookConfig({})).toMatchObject({
      missingKeys: ["GITHUB_WEBHOOK_SECRET", "GITHUB_BOT_TOKEN", "GITHUB_ALLOWED_OWNER"],
      ok: false,
    });
    expect(
      getGitHubWebhookConfig({
        GITHUB_ALLOWED_OWNER: "ef-global",
        GITHUB_BOT_TOKEN: "gh-token",
        GITHUB_WEBHOOK_SECRET: "secret",
      }),
    ).toEqual({
      allowedOwner: "ef-global",
      botToken: "gh-token",
      ok: true,
      secret: "secret",
    });
  });
});
