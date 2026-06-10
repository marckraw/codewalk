import { describe, expect, it, vi } from 'vitest'
import {
  deriveReviewWorkspaceState,
  presentCodeReviewGuideGeneration,
  STALE_RUNNING_GENERATION_ERROR,
  STALE_RUNNING_GENERATION_THRESHOLD_MS,
} from './review-workspace'

vi.mock('server-only', () => ({}))

describe('deriveReviewWorkspaceState', () => {
  it('distinguishes imported, preparing, ready, and failed review states', () => {
    expect(deriveReviewWorkspaceState({ generation: null, guide: null })).toBe(
      'imported',
    )
    expect(
      deriveReviewWorkspaceState({
        generation: { status: 'running' },
        guide: null,
      }),
    ).toBe('preparing')
    expect(
      deriveReviewWorkspaceState({
        generation: { status: 'ready' },
        guide: { status: 'ready' },
      }),
    ).toBe('ready')
    expect(
      deriveReviewWorkspaceState({
        generation: { status: 'failed' },
        guide: null,
      }),
    ).toBe('failed')
    expect(
      deriveReviewWorkspaceState({
        generation: null,
        guide: { status: 'failed' },
      }),
    ).toBe('failed')
  })
})

describe('presentCodeReviewGuideGeneration', () => {
  const now = new Date('2026-06-09T12:00:00Z')

  function runningSince(elapsedMs: number) {
    return {
      error: null,
      startedAt: new Date(now.getTime() - elapsedMs),
      status: 'running' as const,
    }
  }

  it('passes through null and terminal generations', () => {
    expect(presentCodeReviewGuideGeneration(null, now)).toBeNull()

    const failed = {
      error: 'boom',
      startedAt: new Date(0),
      status: 'failed' as const,
    }
    expect(presentCodeReviewGuideGeneration(failed, now)).toBe(failed)
  })

  it('keeps a fresh running generation as preparing', () => {
    const generation = runningSince(STALE_RUNNING_GENERATION_THRESHOLD_MS)

    expect(presentCodeReviewGuideGeneration(generation, now)).toBe(generation)
  })

  it('presents a stale running generation as failed so the UI stops polling', () => {
    const generation = runningSince(STALE_RUNNING_GENERATION_THRESHOLD_MS + 1)

    expect(presentCodeReviewGuideGeneration(generation, now)).toEqual({
      ...generation,
      error: STALE_RUNNING_GENERATION_ERROR,
      status: 'failed',
    })
  })
})
