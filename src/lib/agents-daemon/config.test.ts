import { describe, expect, it, vi } from "vitest";
import { getAgentsDaemonConfig } from "./config";

vi.mock("server-only", () => ({}));

describe("getAgentsDaemonConfig", () => {
  it("normalizes the daemon base URL and keeps the token server-side", () => {
    expect(
      getAgentsDaemonConfig({
        AGENTS_DAEMON_API_TOKEN: " token ",
        AGENTS_DAEMON_BASE_URL: "https://daemon.example.com/",
      }),
    ).toEqual({
      config: {
        apiToken: "token",
        baseUrl: "https://daemon.example.com",
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
  });
});
