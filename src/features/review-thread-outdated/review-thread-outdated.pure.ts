/**
 * GitHub-style conservative outdated rule, applied when a PR gets a new head:
 * a thread stays current only when it anchors the new head itself or its
 * file's diff is byte-identical between the anchor snapshot and the new one.
 * Anything else — file diff changed, file left the diff, anchor snapshot no
 * longer available — marks the thread outdated. The stored excerpt keeps the
 * thread readable.
 */
export function shouldMarkThreadOutdated(input: {
  anchorCommitSha: string
  anchorPatch: string | null
  newHeadSha: string
  newPatch: string | null
}): boolean {
  if (input.anchorCommitSha === input.newHeadSha) {
    return false
  }

  if (input.anchorPatch === null || input.newPatch === null) {
    return true
  }

  return input.anchorPatch !== input.newPatch
}
