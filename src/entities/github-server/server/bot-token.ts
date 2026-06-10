import 'server-only'

import { getGitHubRequestTimeoutMs } from './config'
import { GitHubRestClient } from './rest-client'

export function createServerGitHubRestClient(token: string) {
  return new GitHubRestClient({ timeoutMs: getGitHubRequestTimeoutMs(), token })
}
