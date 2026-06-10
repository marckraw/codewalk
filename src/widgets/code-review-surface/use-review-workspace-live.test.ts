import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewWorkspace } from './review-types'
import { useReviewWorkspaceLive } from './use-review-workspace-live'

function makeWorkspace(state: ReviewWorkspace['state']): ReviewWorkspace {
  return {
    files: [],
    generation: null,
    guide: null,
    snapshot: { id: 'snap-1' },
    state,
  } as unknown as ReviewWorkspace
}

function jsonResponse(workspace: ReviewWorkspace) {
  return { ok: true, json: async () => workspace } as unknown as Response
}

describe('useReviewWorkspaceLive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('polls a preparing workspace until it becomes ready, then stops', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makeWorkspace('preparing')))
      .mockResolvedValueOnce(jsonResponse(makeWorkspace('ready')))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      useReviewWorkspaceLive(makeWorkspace('preparing'), {
        autoGenerate: false,
      }),
    )

    expect(result.current.workspace.state).toBe('preparing')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.workspace.state).toBe('preparing')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500)
    })
    expect(result.current.workspace.state).toBe('ready')

    // No further polling once terminal.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not poll an idle imported workspace', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() =>
      useReviewWorkspaceLive(makeWorkspace('imported'), {
        autoGenerate: false,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('optimistically shows preparing and starts polling when generation is marked started', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeWorkspace('ready')))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      useReviewWorkspaceLive(makeWorkspace('imported'), {
        autoGenerate: false,
      }),
    )

    expect(result.current.workspace.state).toBe('imported')

    act(() => {
      result.current.markGenerationStarted()
    })
    expect(result.current.workspace.state).toBe('preparing')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500)
    })
    expect(result.current.workspace.state).toBe('ready')
    expect(fetchMock).toHaveBeenCalled()
  })
})
