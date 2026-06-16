/**
 * The synthetic "00" overview section grounds the reviewer in the pull request's
 * purpose before they walk the generated sections. It is not a real guide
 * section — it has no risk level, files, or checklist — but it participates in
 * the same rail selection, scroll, active-tracking, and deep-link machinery as
 * the generated sections, so it needs a stable id that never collides with a
 * daemon-issued section id (those are UUIDs).
 */
export const GUIDE_OVERVIEW_SECTION_ID = 'overview'

/**
 * The "00" overview section is shown only when the guide actually carries prose
 * for it; an empty overview leaves the numbered sections untouched.
 */
export function hasGuideOverview(
  overview: string | null | undefined,
): overview is string {
  return typeof overview === 'string' && overview.trim().length > 0
}

export function isGuideOverviewSectionId(
  sectionId: string | null | undefined,
): boolean {
  return sectionId === GUIDE_OVERVIEW_SECTION_ID
}

/**
 * Heading for the overview section. The pull request title narrows the
 * reviewer's attention to what this change is about, falling back to a generic
 * label when the daemon could not resolve a title.
 */
export function guideOverviewTitle(
  pullRequest: { title: string | null } | null | undefined,
): string {
  const title = pullRequest?.title?.trim()
  return title ? title : 'Pull request overview'
}
