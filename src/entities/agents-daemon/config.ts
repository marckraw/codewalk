import "server-only";

import type { CodeReviewGuideProvider } from "@/entities/database";
import { resolvePositiveIntegerEnv } from "@/shared/lib/server-env";
import { resolveAgentsDaemonBaseUrl } from "./protocol";

// Large PRs (~100 files) routinely exceed 4 minutes of daemon work, so allow
// 10 minutes by default. Must stay below the route `maxDuration` (800s) so the
// timeout fires and persists a failed status before Vercel kills the function.
export const DEFAULT_AGENTS_DAEMON_REQUEST_TIMEOUT_MS = 600_000;

export type AgentsDaemonConfig = {
  apiToken: string;
  baseUrl: string;
  defaultEffort: string | null;
  defaultModel: string;
  defaultProvider: CodeReviewGuideProvider;
  requestTimeoutMs: number;
};

export type AgentsDaemonConfigResult =
  | { ok: true; config: AgentsDaemonConfig }
  | {
      ok: false;
      message: string;
      missingKeys: string[];
      state:
        | "invalid-base-url"
        | "invalid-default-provider"
        | "missing-base-url"
        | "missing-default-model"
        | "missing-default-provider"
        | "missing-token";
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

  const defaultProvider = env.DEFAULT_GUIDE_PROVIDER?.trim() ?? "";

  if (!defaultProvider) {
    return {
      message: "DEFAULT_GUIDE_PROVIDER is required for remote guided reviews.",
      missingKeys: ["DEFAULT_GUIDE_PROVIDER"],
      ok: false,
      state: "missing-default-provider",
    };
  }

  if (!isCodeReviewGuideProvider(defaultProvider)) {
    return {
      message: "DEFAULT_GUIDE_PROVIDER must be one of: claude, codex, cursor, gemini.",
      missingKeys: [],
      ok: false,
      state: "invalid-default-provider",
    };
  }

  const defaultModel = env.DEFAULT_GUIDE_MODEL?.trim() ?? "";

  if (!defaultModel) {
    return {
      message: "DEFAULT_GUIDE_MODEL is required for remote guided reviews.",
      missingKeys: ["DEFAULT_GUIDE_MODEL"],
      ok: false,
      state: "missing-default-model",
    };
  }

  return {
    config: {
      apiToken,
      baseUrl: baseUrl.baseUrl,
      defaultEffort: env.DEFAULT_GUIDE_EFFORT?.trim() || null,
      defaultModel,
      defaultProvider,
      requestTimeoutMs: getAgentsDaemonRequestTimeoutMs(env),
    },
    ok: true,
  };
}

export function getAgentsDaemonRequestTimeoutMs(env: Record<string, string | undefined> = process.env) {
  return resolvePositiveIntegerEnv(env, "AGENTS_DAEMON_REQUEST_TIMEOUT_MS", DEFAULT_AGENTS_DAEMON_REQUEST_TIMEOUT_MS);
}

function isCodeReviewGuideProvider(value: string): value is CodeReviewGuideProvider {
  return value === "claude" || value === "codex" || value === "cursor" || value === "gemini";
}
