import { describe, expect, it, vi } from "vitest";
import { getAgentsDaemonConfig } from "./config";

vi.mock("server-only", () => ({}));

describe("getAgentsDaemonConfig", () => {
  it("normalizes the daemon base URL and keeps the token server-side", () => {
    expect(
      getAgentsDaemonConfig({
        AGENTS_DAEMON_API_TOKEN: " token ",
        AGENTS_DAEMON_BASE_URL: "https://daemon.example.com/",
        DEFAULT_GUIDE_EFFORT: " high ",
        DEFAULT_GUIDE_MODEL: " gpt-5.4 ",
        DEFAULT_GUIDE_PROVIDER: "codex",
      }),
    ).toEqual({
      config: {
        apiToken: "token",
        baseUrl: "https://daemon.example.com",
        defaultEffort: "high",
        defaultModel: "gpt-5.4",
        defaultProvider: "codex",
        requestTimeoutMs: 240000,
      },
      ok: true,
    });
  });

  it("resolves an optional request timeout", () => {
    expect(
      getAgentsDaemonConfig({
        AGENTS_DAEMON_API_TOKEN: "token",
        AGENTS_DAEMON_BASE_URL: "https://daemon.example.com",
        AGENTS_DAEMON_REQUEST_TIMEOUT_MS: "60000",
        DEFAULT_GUIDE_MODEL: "gpt-5.4",
        DEFAULT_GUIDE_PROVIDER: "codex",
      }),
    ).toMatchObject({
      config: {
        requestTimeoutMs: 60000,
      },
      ok: true,
    });

    expect(
      getAgentsDaemonConfig({
        AGENTS_DAEMON_API_TOKEN: "token",
        AGENTS_DAEMON_BASE_URL: "https://daemon.example.com",
        AGENTS_DAEMON_REQUEST_TIMEOUT_MS: "not-a-number",
        DEFAULT_GUIDE_MODEL: "gpt-5.4",
        DEFAULT_GUIDE_PROVIDER: "codex",
      }),
    ).toMatchObject({
      config: {
        requestTimeoutMs: 240000,
      },
      ok: true,
    });
  });

  it("reports missing and invalid deployment configuration", () => {
    expect(getAgentsDaemonConfig({} as NodeJS.ProcessEnv)).toMatchObject({
      missingKeys: ["AGENTS_DAEMON_BASE_URL"],
      ok: false,
      state: "missing-base-url",
    });
    expect(
      getAgentsDaemonConfig({
        AGENTS_DAEMON_API_TOKEN: "token",
        AGENTS_DAEMON_BASE_URL: "ftp://daemon.example.com",
      }),
    ).toMatchObject({
      ok: false,
      state: "invalid-base-url",
    });
    expect(
      getAgentsDaemonConfig({
        AGENTS_DAEMON_BASE_URL: "https://daemon.example.com",
      }),
    ).toMatchObject({
      missingKeys: ["AGENTS_DAEMON_API_TOKEN"],
      ok: false,
      state: "missing-token",
    });
    expect(
      getAgentsDaemonConfig({
        AGENTS_DAEMON_API_TOKEN: "token",
        AGENTS_DAEMON_BASE_URL: "https://daemon.example.com",
      }),
    ).toMatchObject({
      missingKeys: ["DEFAULT_GUIDE_PROVIDER"],
      ok: false,
      state: "missing-default-provider",
    });
    expect(
      getAgentsDaemonConfig({
        AGENTS_DAEMON_API_TOKEN: "token",
        AGENTS_DAEMON_BASE_URL: "https://daemon.example.com",
        DEFAULT_GUIDE_PROVIDER: "openai",
      }),
    ).toMatchObject({
      ok: false,
      state: "invalid-default-provider",
    });
    expect(
      getAgentsDaemonConfig({
        AGENTS_DAEMON_API_TOKEN: "token",
        AGENTS_DAEMON_BASE_URL: "https://daemon.example.com",
        DEFAULT_GUIDE_PROVIDER: "codex",
      }),
    ).toMatchObject({
      missingKeys: ["DEFAULT_GUIDE_MODEL"],
      ok: false,
      state: "missing-default-model",
    });
  });
});
