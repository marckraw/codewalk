/**
 * Describe why a file has no renderable text diff.
 *
 * Returns a human-readable message for the common "no patch" cases (removed,
 * binary, empty/added), or `null` when there is non-empty content that simply
 * isn't a parseable hunk — in which case the caller should show the raw text.
 */
export function describeMissingPierrePatch(input: {
  diff: string
  fileStatus?: string | null
}): string | null {
  const trimmed = input.diff.trim()
  const status = input.fileStatus ?? null

  if (status === 'removed') {
    return 'This file was removed in the pull request.'
  }

  if (
    /^Binary files /m.test(input.diff) ||
    input.diff.includes('GIT binary patch')
  ) {
    return 'Binary file — no text diff to display.'
  }

  if (!trimmed) {
    return status === 'added'
      ? 'New file — no patch was captured for this snapshot.'
      : 'No patch was captured for this file.'
  }

  return null
}
