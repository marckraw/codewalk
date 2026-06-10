import type { ReviewWorkspaceState } from '@/entities/database'

export const REVIEW_WORKSPACE_POLL_INTERVAL_MS = 2500

export function isTerminalReviewWorkspaceState(
  state: ReviewWorkspaceState,
): boolean {
  return state === 'ready' || state === 'failed'
}

/**
 * Decide whether the live workspace should keep polling for updates.
 *
 * Polling runs while a guide is actively being prepared, or while a generation
 * request has been kicked off locally but the server has not yet reported a
 * terminal state. It always stops once the workspace reaches `ready`/`failed`.
 */
export function shouldPollReviewWorkspace(
  state: ReviewWorkspaceState,
  pending: boolean,
): boolean {
  if (isTerminalReviewWorkspaceState(state)) {
    return false
  }

  return state === 'preparing' || pending
}
