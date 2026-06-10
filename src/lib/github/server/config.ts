import "server-only";

import { resolvePositiveIntegerEnv } from "@/lib/server-env";

export const DEFAULT_GITHUB_REQUEST_TIMEOUT_MS = 30_000;

export type GitHubAutomationConfig =
  | {
      allowedOwner: string;
      botToken: string;
      ok: true;
    }
  | {
      message: string;
      missingKeys: string[];
      ok: false;
    };

export function getGitHubRequestTimeoutMs(env: Record<string, string | undefined> = process.env) {
  return resolvePositiveIntegerEnv(env, "GITHUB_REQUEST_TIMEOUT_MS", DEFAULT_GITHUB_REQUEST_TIMEOUT_MS);
}

export function getGitHubAutomationConfig(
  env: Record<string, string | undefined> = process.env,
): GitHubAutomationConfig {
  const botToken = env.GITHUB_BOT_TOKEN?.trim() ?? "";
  const allowedOwner = env.GITHUB_ALLOWED_OWNER?.trim() ?? "";
  const missingKeys = [
    botToken ? null : "GITHUB_BOT_TOKEN",
    allowedOwner ? null : "GITHUB_ALLOWED_OWNER",
  ].filter((key): key is string => Boolean(key));

  if (missingKeys.length > 0) {
    return {
      message: `GitHub automation configuration is missing: ${missingKeys.join(", ")}.`,
      missingKeys,
      ok: false,
    };
  }

  return {
    allowedOwner,
    botToken,
    ok: true,
  };
}
