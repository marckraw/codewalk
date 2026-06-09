import "server-only";

import { resolveAgentsDaemonBaseUrl } from "./protocol";

export type AgentsDaemonConfig = {
  apiToken: string;
  baseUrl: string;
};

export type AgentsDaemonConfigResult =
  | { ok: true; config: AgentsDaemonConfig }
  | {
      ok: false;
      message: string;
      missingKeys: string[];
      state: "missing-base-url" | "invalid-base-url" | "missing-token";
    };

export function getAgentsDaemonConfig(env: Record<string, string | undefined> = process.env): AgentsDaemonConfigResult {
  const baseUrl = resolveAgentsDaemonBaseUrl(env.AGENTS_DAEMON_BASE_URL);

  if (!baseUrl.ok) {
    const state = baseUrl.reason === "missing" ? "missing-base-url" : "invalid-base-url";

    return {
      message:
        state === "missing-base-url"
          ? "AGENTS_DAEMON_BASE_URL is required for remote guided reviews."
          : "AGENTS_DAEMON_BASE_URL must be an HTTP(S) URL.",
      missingKeys: state === "missing-base-url" ? ["AGENTS_DAEMON_BASE_URL"] : [],
      ok: false,
      state,
    };
  }

  const apiToken = env.AGENTS_DAEMON_API_TOKEN?.trim() ?? "";

  if (!apiToken) {
    return {
      message: "AGENTS_DAEMON_API_TOKEN is required for remote guided reviews.",
      missingKeys: ["AGENTS_DAEMON_API_TOKEN"],
      ok: false,
      state: "missing-token",
    };
  }

  return {
    config: {
      apiToken,
      baseUrl: baseUrl.baseUrl,
    },
    ok: true,
  };
}
