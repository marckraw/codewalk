import "server-only";

import { resolvePositiveIntegerEnv } from "@/lib/server-env";

export const DEFAULT_GITHUB_REQUEST_TIMEOUT_MS = 30_000;

export function getGitHubRequestTimeoutMs(env: Record<string, string | undefined> = process.env) {
  return resolvePositiveIntegerEnv(env, "GITHUB_REQUEST_TIMEOUT_MS", DEFAULT_GITHUB_REQUEST_TIMEOUT_MS);
}
