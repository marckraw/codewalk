import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { missingGitHubAuthError, missingGitHubScopeError } from "./errors";

export async function getCurrentUserGitHubAccessToken() {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    throw missingGitHubAuthError();
  }

  const client = await clerkClient();
  const tokens = await client.users.getUserOauthAccessToken(userId, "github");
  const token = tokens.data[0]?.token;

  if (!token) {
    throw missingGitHubScopeError();
  }

  return token;
}

export async function createCurrentUserGitHubRestClient() {
  const { getGitHubRequestTimeoutMs } = await import("./config");
  const { GitHubRestClient } = await import("./rest-client");
  return new GitHubRestClient({
    timeoutMs: getGitHubRequestTimeoutMs(),
    token: await getCurrentUserGitHubAccessToken(),
  });
}
