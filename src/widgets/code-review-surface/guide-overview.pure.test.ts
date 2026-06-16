import { describe, expect, it } from 'vitest'
import {
  GUIDE_OVERVIEW_SECTION_ID,
  guideOverviewTitle,
  hasGuideOverview,
  isGuideOverviewSectionId,
} from './guide-overview.pure'

describe('hasGuideOverview', () => {
  it('is true for non-empty prose', () => {
    expect(hasGuideOverview('Reconciles stale generation status.')).toBe(true)
  })

  it('is false for empty, whitespace, null, or undefined', () => {
    expect(hasGuideOverview('')).toBe(false)
    expect(hasGuideOverview('   \n  ')).toBe(false)
    expect(hasGuideOverview(null)).toBe(false)
    expect(hasGuideOverview(undefined)).toBe(false)
  })
})

describe('isGuideOverviewSectionId', () => {
  it('matches only the reserved overview id', () => {
    expect(isGuideOverviewSectionId(GUIDE_OVERVIEW_SECTION_ID)).toBe(true)
    expect(isGuideOverviewSectionId('a-real-uuid-section-id')).toBe(false)
    expect(isGuideOverviewSectionId(null)).toBe(false)
    expect(isGuideOverviewSectionId(undefined)).toBe(false)
  })
})

describe('guideOverviewTitle', () => {
  it('uses the trimmed pull request title when present', () => {
    expect(
      guideOverviewTitle({ title: '  Reconcile in-flight generations  ' }),
    ).toBe('Reconcile in-flight generations')
  })

  it('falls back to a generic label when the title is missing', () => {
    expect(guideOverviewTitle({ title: null })).toBe('Pull request overview')
    expect(guideOverviewTitle({ title: '   ' })).toBe('Pull request overview')
    expect(guideOverviewTitle(null)).toBe('Pull request overview')
    expect(guideOverviewTitle(undefined)).toBe('Pull request overview')
  })
})
