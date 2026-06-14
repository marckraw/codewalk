import type { ReviewMode } from './review-types'

export interface ReviewDeepLink {
  filePath: string | null
  sectionId: string | null
  view: ReviewMode | null
}

/** Narrow an arbitrary query value to a valid review view, or null. */
export function parseReviewView(
  value: string | null | undefined,
): ReviewMode | null {
  return value === 'guide' || value === 'diff' || value === 'discussions'
    ? value
    : null
}

function firstParam(
  value: string | string[] | null | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null
  }

  return value?.trim() || null
}

/** Read the deep-link target (view + section/file) from page search params. */
export function parseReviewDeepLink(searchParams: {
  file?: string | string[]
  section?: string | string[]
  view?: string | string[]
}): ReviewDeepLink {
  return {
    filePath: firstParam(searchParams.file),
    sectionId: firstParam(searchParams.section),
    view: parseReviewView(firstParam(searchParams.view)),
  }
}

/**
 * Build the canonical query string for the current selection.
 *
 * Guide view links carry the active `section`; diff view links carry the
 * selected `file`. The result is stable for a given selection so callers can
 * skip redundant history updates.
 */
export function buildReviewDeepLinkQuery(input: {
  filePath: string | null
  sectionId: string | null
  view: ReviewMode
}): string {
  const params = new URLSearchParams()
  params.set('view', input.view)

  if (input.view === 'guide' && input.sectionId) {
    params.set('section', input.sectionId)
  }

  if (input.view === 'diff' && input.filePath) {
    params.set('file', input.filePath)
  }

  return `?${params.toString()}`
}
