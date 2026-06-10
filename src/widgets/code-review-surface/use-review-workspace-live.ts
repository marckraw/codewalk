'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReviewWorkspace } from './review-types'
import {
  REVIEW_WORKSPACE_POLL_INTERVAL_MS,
  shouldPollReviewWorkspace,
} from './use-review-workspace-live.pure'

interface UseReviewWorkspaceLiveOptions {
  autoGenerate: boolean
}

interface UseReviewWorkspaceLiveResult {
  /** Notify the hook that a generation request has been kicked off locally. */
  markGenerationStarted: () => void
  /** The latest known workspace, refreshed by polling while a guide is preparing. */
  workspace: ReviewWorkspace
}

/**
 * Keeps a review workspace live without a manual refresh: while a guide is being
 * prepared, it polls the read-only workspace API and swaps in fresh data, then
 * stops as soon as the workspace reaches a terminal (`ready`/`failed`) state.
 */
export function useReviewWorkspaceLive(
  initialWorkspace: ReviewWorkspace,
  { autoGenerate }: UseReviewWorkspaceLiveOptions,
): UseReviewWorkspaceLiveResult {
  const snapshotId = initialWorkspace.snapshot.id
  const [workspace, setWorkspace] = useState<ReviewWorkspace>(initialWorkspace)
  const [pending, setPending] = useState(autoGenerate)

  // Reset when the route points at a different snapshot (client navigation).
  const lastSnapshotId = useRef(snapshotId)
  useEffect(() => {
    if (lastSnapshotId.current !== snapshotId) {
      lastSnapshotId.current = snapshotId
      setWorkspace(initialWorkspace)
      setPending(autoGenerate)
    }
  }, [autoGenerate, initialWorkspace, snapshotId])

  const active = shouldPollReviewWorkspace(workspace.state, pending)

  useEffect(() => {
    if (!active) {
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/review-workspaces/${encodeURIComponent(snapshotId)}`,
          {
            cache: 'no-store',
          },
        )

        if (cancelled) {
          return
        }

        if (response.ok) {
          const next = (await response.json()) as ReviewWorkspace

          if (cancelled) {
            return
          }

          setWorkspace(next)

          if (next.state === 'ready' || next.state === 'failed') {
            setPending(false)
            return
          }
        }
      } catch {
        // Transient network error — keep polling on the next tick.
      }

      if (!cancelled) {
        timer = setTimeout(() => void poll(), REVIEW_WORKSPACE_POLL_INTERVAL_MS)
      }
    }

    timer = setTimeout(() => void poll(), REVIEW_WORKSPACE_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [active, snapshotId])

  const markGenerationStarted = useCallback(() => {
    setPending(true)
    // Optimistically reflect that work has begun so the preparing state shows
    // immediately, before the first poll observes the running generation row.
    setWorkspace((current) =>
      current.state === 'imported'
        ? { ...current, state: 'preparing' }
        : current,
    )
  }, [])

  return { markGenerationStarted, workspace }
}
