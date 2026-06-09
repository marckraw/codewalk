import "server-only";

import { GitHubRestClient } from "./rest-client";

export function createServerGitHubRestClient(token: string) {
  return new GitHubRestClient({ token });
}
