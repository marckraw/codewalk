/**
 * Reconciling asks the daemon for ground truth about a generation's job.
 * Skip rows the daemon cannot know about (no job submitted yet) and rows so
 * fresh that the submit may still be in flight.
 */
export const MIN_RECONCILE_GENERATION_AGE_MS = 10_000

export type ReconcileGenerationDecision =
  | { reconcile: true; daemonJobId: string }
  | {
      reconcile: false
      reason: 'no-generation' | 'not-running' | 'no-job' | 'too-fresh'
    }

export function shouldReconcileCodeReviewGuideGeneration(
  generation: {
    daemonJobId: string | null
    startedAt: Date | string
    status: string
  } | null,
  now: Date,
): ReconcileGenerationDecision {
  if (!generation) {
    return { reconcile: false, reason: 'no-generation' }
  }

  if (generation.status !== 'running') {
    return { reconcile: false, reason: 'not-running' }
  }

  if (!generation.daemonJobId) {
    return { reconcile: false, reason: 'no-job' }
  }

  const startedAt =
    generation.startedAt instanceof Date
      ? generation.startedAt
      : new Date(generation.startedAt)

  if (now.getTime() - startedAt.getTime() < MIN_RECONCILE_GENERATION_AGE_MS) {
    return { reconcile: false, reason: 'too-fresh' }
  }

  return { daemonJobId: generation.daemonJobId, reconcile: true }
}
