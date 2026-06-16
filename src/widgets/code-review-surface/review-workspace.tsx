'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DiffLineAnnotation, SelectedLineRange } from '@pierre/diffs'
import {
  GitCompareArrows,
  GitPullRequestArrow,
  ListTree,
  MessagesSquare,
} from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/cn.pure'
import {
  addReviewThreadComment,
  approveReviewThreadFix,
  buildReviewThreadSelectionAnchor,
  createReviewThread,
  discardReviewThreadFix,
  extendReviewThreadSelection,
  fetchReviewAgentSessionStatus,
  listReviewThreads,
  pierreSideFromReviewThreadDiffSide,
  pollReviewThreadAgentReply,
  requestReviewThreadAgentFix,
  requestReviewThreadAgentReply,
  updateReviewThreadStatus,
  type ReviewThread,
  type ReviewThreadAnchorRef,
} from '@/entities/review-thread'
import { DiscussionsView } from './discussions-view.presentational'
import { FileRail } from './file-rail'
import { GuideEmptyPane } from './guide-empty-pane'
import { GuidePreparingPane } from './guide-preparing-pane'
import { GuideRail } from './guide-rail'
import { GuideView } from './guide-view'
import {
  GUIDE_OVERVIEW_SECTION_ID,
  hasGuideOverview,
} from './guide-overview.pure'
import { ModeButton } from './mode-button'
import { PierreDiffViewer } from './pierre-diff-viewer'
import { PinnedDiscussionComposer } from './pinned-discussion-composer.presentational'
import { PullRequestStatusBadge } from './pull-request-status-badge'
import { ReviewThreadAnnotation } from './review-thread-annotation.presentational'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'
import type {
  ReviewFile,
  ReviewMode,
  ReviewWorkspace as ReviewWorkspaceModel,
} from './review-types'
import type { ReviewDeepLink } from './review-deep-link.pure'
import { buildReviewDeepLinkQuery } from './review-deep-link.pure'
import { WorkspaceStatusBadge } from './workspace-status-badge'
import { useReviewWorkspaceLive } from './use-review-workspace-live'

interface ReviewWorkspaceProps {
  autoGenerate: boolean
  deepLink?: ReviewDeepLink
  workspace: ReviewWorkspaceModel
}

const EMPTY_DEEP_LINK: ReviewDeepLink = {
  filePath: null,
  sectionId: null,
  view: null,
}

export function ReviewWorkspace({
  autoGenerate,
  deepLink = EMPTY_DEEP_LINK,
  workspace: initialWorkspace,
}: ReviewWorkspaceProps) {
  const { markGenerationStarted, workspace } = useReviewWorkspaceLive(
    initialWorkspace,
    { autoGenerate },
  )
  const [selectedView, setSelectedView] = useState<ReviewMode>(
    deepLink.view ??
      (initialWorkspace.guide ||
      autoGenerate ||
      initialWorkspace.state === 'preparing' ||
      initialWorkspace.state === 'failed'
        ? 'guide'
        : 'diff'),
  )
  const [guideSectionListCollapsed, setGuideSectionListCollapsed] =
    useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    if (
      deepLink.filePath &&
      initialWorkspace.files.some((file) => file.path === deepLink.filePath)
    ) {
      return deepLink.filePath
    }

    return initialWorkspace.files[0]?.path ?? null
  })
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeGuideSectionId, setActiveGuideSectionId] = useState<
    string | null
  >(() => {
    const guide = initialWorkspace.guide
    const overviewAvailable = hasGuideOverview(guide?.overview)

    if (deepLink.sectionId) {
      if (
        deepLink.sectionId === GUIDE_OVERVIEW_SECTION_ID &&
        overviewAvailable
      ) {
        return deepLink.sectionId
      }
      if (
        guide?.sections.some((section) => section.id === deepLink.sectionId)
      ) {
        return deepLink.sectionId
      }
    }

    if (overviewAvailable) {
      return GUIDE_OVERVIEW_SECTION_ID
    }

    return guide?.sections[0]?.id ?? null
  })
  const guideSectionRefs = useRef(new Map<string, HTMLElement>())
  const guideFileRefs = useRef(new Map<string, HTMLElement>())
  const hasAppliedInitialDeepLink = useRef(false)
  const [selectedLines, setSelectedLines] = useState<SelectedLineRange | null>(
    null,
  )
  const [reviewThreads, setReviewThreads] = useState<ReviewThread[]>([])
  const [reviewThreadLoadError, setReviewThreadLoadError] = useState<
    string | null
  >(null)
  const [draftBody, setDraftBody] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [isPostingDraft, setIsPostingDraft] = useState(false)
  const [pinnedAnchors, setPinnedAnchors] = useState<ReviewThreadAnchorRef[]>(
    [],
  )
  const [discussionBody, setDiscussionBody] = useState('')
  const [discussionError, setDiscussionError] = useState<string | null>(null)
  const [isPostingDiscussion, setIsPostingDiscussion] = useState(false)
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({})
  const [threadErrors, setThreadErrors] = useState<Record<string, string>>({})
  const [replyingThreadId, setReplyingThreadId] = useState<string | null>(null)
  const [agentActivity, setAgentActivity] = useState<string | null>(null)
  const [updatingStatusThreadId, setUpdatingStatusThreadId] = useState<
    string | null
  >(null)
  const [askingFixThreadId, setAskingFixThreadId] = useState<string | null>(
    null,
  )
  const [fixAction, setFixAction] = useState<{
    commentId: string
    kind: 'push' | 'discard'
  } | null>(null)
  const shiftPressedRef = useRef(false)
  const selectionFileRef = useRef<string | null>(null)

  const statusCounts = useMemo(
    () => countFilesByStatus(workspace.files),
    [workspace.files],
  )
  const visibleFiles = useMemo(
    () =>
      statusFilter === 'all'
        ? workspace.files
        : workspace.files.filter((file) => file.status === statusFilter),
    [statusFilter, workspace.files],
  )
  const selectedVisibleFile = useMemo(
    () => visibleFiles.find((file) => file.path === selectedFile)?.path ?? null,
    [selectedFile, visibleFiles],
  )
  const effectiveActiveGuideSectionId = useMemo(() => {
    const guide = workspace.guide
    if (!guide) {
      return null
    }

    const overviewAvailable = hasGuideOverview(guide.overview)

    if (
      activeGuideSectionId &&
      (guide.sections.some((section) => section.id === activeGuideSectionId) ||
        (overviewAvailable &&
          activeGuideSectionId === GUIDE_OVERVIEW_SECTION_ID))
    ) {
      return activeGuideSectionId
    }

    if (overviewAvailable) {
      return GUIDE_OVERVIEW_SECTION_ID
    }

    return guide.sections[0]?.id ?? null
  }, [activeGuideSectionId, workspace.guide])
  const diffByPath = useMemo(
    () => new Map(workspace.files.map((file) => [file.path, file.patch ?? ''])),
    [workspace.files],
  )
  const statusByPath = useMemo(
    () => new Map(workspace.files.map((file) => [file.path, file.status])),
    [workspace.files],
  )
  const selectedDiff = selectedFile ? (diffByPath.get(selectedFile) ?? '') : ''
  const selectedFileStatus = selectedFile
    ? (statusByPath.get(selectedFile) ?? null)
    : null
  const selectedThreadAnchor = useMemo(
    () =>
      buildReviewThreadSelectionAnchor({
        patch: selectedDiff,
        range: selectedLines,
      }),
    [selectedDiff, selectedLines],
  )
  // Discussion-kind threads are whole-PR conversations shown in the Discussions
  // tab — they must not render as inline diff annotations.
  const inlineThreads = useMemo(
    () => reviewThreads.filter((thread) => thread.kind !== 'discussion'),
    [reviewThreads],
  )
  const discussionThreads = useMemo(
    () => reviewThreads.filter((thread) => thread.kind === 'discussion'),
    [reviewThreads],
  )
  const visibleThreads = useMemo(
    () =>
      selectedFile
        ? inlineThreads.filter((thread) => thread.filePath === selectedFile)
        : [],
    [inlineThreads, selectedFile],
  )
  const threadsByFile = useMemo(() => {
    const map = new Map<string, ReviewThread[]>()

    for (const thread of inlineThreads) {
      const list = map.get(thread.filePath)
      if (list) {
        list.push(thread)
      } else {
        map.set(thread.filePath, [thread])
      }
    }

    return map
  }, [inlineThreads])

  /**
   * Single selection across both views: selecting lines in any file (diff
   * pane or a guide file diff) makes that file the active one, and
   * shift-click extends the previous range within the same file.
   */
  const handleFileSelectedLinesChange = useCallback(
    (filePath: string, range: SelectedLineRange | null) => {
      const sameFile = selectionFileRef.current === filePath
      selectionFileRef.current = filePath
      setSelectedFile(filePath)
      setSelectedLines((previous) =>
        extendReviewThreadSelection({
          next: range,
          previous: sameFile ? previous : null,
          shiftKey: shiftPressedRef.current,
        }),
      )
    },
    [],
  )

  // Shift state for GitHub-style shift-click range extension in the gutter.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      shiftPressedRef.current = event.shiftKey
    }

    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)

    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
    }
  }, [])

  // Threads whose latest agent comment is still pending. Derived from data so
  // a page refresh (or another viewer's question) resumes polling naturally.
  const pendingAgentThreadIds = useMemo(
    () =>
      reviewThreads
        .filter((thread) => thread.comments.some(isAgentReplyInFlight))
        .map((thread) => thread.id),
    [reviewThreads],
  )
  const pendingAgentThreadsKey = pendingAgentThreadIds.join(',')

  // Drive pending turns to completion: each tick advances the server-side
  // state machine (send when idle, complete when the turn ended) and merges
  // the updated thread. The turn itself never lives inside one request, so
  // serverless time limits cannot orphan it.
  useEffect(() => {
    if (!pendingAgentThreadsKey) {
      setAgentActivity(null)
      return
    }

    let cancelled = false

    async function pollPendingThreads() {
      for (const threadId of pendingAgentThreadsKey.split(',')) {
        try {
          const updated = await pollReviewThreadAgentReply(threadId)
          if (cancelled) return
          setReviewThreads((current) =>
            current.map((thread) =>
              thread.id === updated.id ? updated : thread,
            ),
          )
        } catch {
          // Transient polling errors are retried on the next tick; terminal
          // failures land on the comment row server-side.
        }
      }

      try {
        const status = await fetchReviewAgentSessionStatus({
          number: workspace.snapshot.number,
          owner: workspace.snapshot.owner,
          repo: workspace.snapshot.repo,
        })
        if (!cancelled) {
          setAgentActivity(status.activity ?? status.state)
        }
      } catch {
        // Activity is decorative; polling errors must not surface.
      }
    }

    void pollPendingThreads()
    // Poll faster while a turn is in flight so the streamed reply updates feel
    // close to live rather than arriving in 3s chunks.
    const interval = setInterval(() => void pollPendingThreads(), 1_200)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [
    pendingAgentThreadsKey,
    workspace.snapshot.number,
    workspace.snapshot.owner,
    workspace.snapshot.repo,
  ])

  useEffect(() => {
    let cancelled = false

    async function loadThreads() {
      setReviewThreadLoadError(null)

      try {
        const threads = await listReviewThreads({
          number: workspace.snapshot.number,
          owner: workspace.snapshot.owner,
          repo: workspace.snapshot.repo,
        })
        if (!cancelled) {
          setReviewThreads(threads)
        }
      } catch (error) {
        if (!cancelled) {
          setReviewThreadLoadError(reviewThreadErrorMessage(error))
        }
      }
    }

    void loadThreads()

    return () => {
      cancelled = true
    }
  }, [
    workspace.snapshot.number,
    workspace.snapshot.owner,
    workspace.snapshot.repo,
  ])

  useEffect(() => {
    if (
      selectedView !== 'guide' ||
      !workspace.guide ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }

    const observedSections = [
      ...(hasGuideOverview(workspace.guide.overview)
        ? [
            {
              id: GUIDE_OVERVIEW_SECTION_ID,
              node: guideSectionRefs.current.get(GUIDE_OVERVIEW_SECTION_ID),
            },
          ]
        : []),
      ...workspace.guide.sections.map((section) => ({
        id: section.id,
        node: guideSectionRefs.current.get(section.id),
      })),
    ].filter(
      (entry): entry is { id: string; node: HTMLElement } =>
        entry.node !== undefined,
    )

    if (observedSections.length === 0) {
      return
    }

    const sectionIdByNode = new Map(
      observedSections.map((section) => [section.node, section.id]),
    )
    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0]
        const sectionId = activeEntry
          ? (sectionIdByNode.get(activeEntry.target as HTMLElement) ?? null)
          : null

        if (sectionId) {
          setActiveGuideSectionId(sectionId)
        }
      },
      {
        root: null,
        rootMargin: '-18% 0px -60% 0px',
        threshold: 0,
      },
    )

    for (const section of observedSections) {
      observer.observe(section.node)
    }

    return () => observer.disconnect()
  }, [selectedView, workspace.guide])

  // Scroll to the deep-linked section/file once the guide is rendered.
  useEffect(() => {
    if (
      hasAppliedInitialDeepLink.current ||
      selectedView !== 'guide' ||
      !workspace.guide
    ) {
      return
    }

    const sectionNode = deepLink.sectionId
      ? guideSectionRefs.current.get(deepLink.sectionId)
      : undefined
    const fileNode = deepLink.filePath
      ? guideFileRefs.current.get(deepLink.filePath)
      : undefined
    const target = sectionNode ?? fileNode

    if (target) {
      hasAppliedInitialDeepLink.current = true
      target.scrollIntoView({ block: 'start', inline: 'nearest' })
    }
  }, [deepLink.filePath, deepLink.sectionId, selectedView, workspace.guide])

  // Reflect the current selection in the URL so the view is shareable, without
  // adding history entries (replaceState) or triggering a server navigation.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const query = buildReviewDeepLinkQuery({
      filePath: selectedFile,
      sectionId: effectiveActiveGuideSectionId,
      view: selectedView,
    })

    if (query !== window.location.search) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query}`,
      )
    }
  }, [effectiveActiveGuideSectionId, selectedFile, selectedView])

  const clearSelectedReviewThreadDraft = useCallback(() => {
    setSelectedLines(null)
    setDraftBody('')
    setDraftError(null)
  }, [])

  const handleSelectFile = useCallback(
    (filePath: string) => {
      setSelectedFile(filePath)
      clearSelectedReviewThreadDraft()
    },
    [clearSelectedReviewThreadDraft],
  )

  // Clicking a reference chip in a Discussions card opens that selection in the
  // diff view so the reviewer can read the code the conversation is about.
  const jumpToAnchor = useCallback((anchor: ReviewThreadAnchorRef) => {
    const side = pierreSideFromReviewThreadDiffSide(anchor.side)
    selectionFileRef.current = anchor.filePath
    setSelectedView('diff')
    setSelectedFile(anchor.filePath)
    setSelectedLines({
      end: anchor.lineEnd,
      endSide: side,
      side,
      start: anchor.lineStart,
    })
  }, [])

  const handleStatusFilterChange = useCallback(
    (nextFilter: string) => {
      setStatusFilter(nextFilter)
      setSelectedFile(null)
      clearSelectedReviewThreadDraft()
    },
    [clearSelectedReviewThreadDraft],
  )

  const handleSelectGuideSection = useCallback((sectionId: string) => {
    setActiveGuideSectionId(sectionId)
    guideSectionRefs.current
      .get(sectionId)
      ?.scrollIntoView({ block: 'start', inline: 'nearest' })
  }, [])

  const handleSelectGuideFile = useCallback(
    (filePath: string) => {
      setSelectedFile(filePath)
      guideFileRefs.current
        .get(filePath)
        ?.scrollIntoView({ block: 'start', inline: 'nearest' })
      clearSelectedReviewThreadDraft()
    },
    [clearSelectedReviewThreadDraft],
  )

  const updateReplyBody = useCallback((threadId: string, body: string) => {
    setReplyBodies((current) => ({ ...current, [threadId]: body }))
  }, [])

  const updateReviewThreadStatusFromAnnotation = useCallback(
    async (threadId: string, status: 'open' | 'resolved') => {
      setUpdatingStatusThreadId(threadId)
      setThreadErrors((current) => ({ ...current, [threadId]: '' }))

      try {
        const updated = await updateReviewThreadStatus({ status, threadId })
        setReviewThreads((current) =>
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  status: updated.status,
                  updatedAt: updated.updatedAt,
                }
              : thread,
          ),
        )
      } catch (error) {
        setThreadErrors((current) => ({
          ...current,
          [threadId]: reviewThreadErrorMessage(error),
        }))
      } finally {
        setUpdatingStatusThreadId(null)
      }
    },
    [],
  )

  /**
   * Kicks off an agent turn. The request returns as soon as the question is
   * queued (with the pending agent comment persisted server-side); the
   * polling effect above drives it to completion.
   */
  const runAgentReplyForThread = useCallback(async (threadId: string) => {
    try {
      const updated = await requestReviewThreadAgentReply(threadId)
      setReviewThreads((current) =>
        current.map((thread) => (thread.id === threadId ? updated : thread)),
      )
    } catch (error) {
      const message = reviewThreadErrorMessage(error)
      setThreadErrors((current) => ({ ...current, [threadId]: message }))
      // The server marks the pending comment as errored too; refresh so the
      // thread shows it.
      try {
        const refreshed = await pollReviewThreadAgentReply(threadId)
        setReviewThreads((current) =>
          current.map((thread) =>
            thread.id === refreshed.id ? refreshed : thread,
          ),
        )
      } catch {
        // The inline thread error above is enough.
      }
    }
  }, [])

  const askAgentInThread = useCallback(
    async (threadId: string) => {
      const body = replyBodies[threadId]?.trim() ?? ''

      if (!body) {
        setThreadErrors((current) => ({
          ...current,
          [threadId]: 'Enter a question before asking the agent.',
        }))
        return
      }

      setReplyingThreadId(threadId)
      setThreadErrors((current) => ({ ...current, [threadId]: '' }))

      // Optimistic: show the question instantly (dimmed) and clear the box, so
      // hitting "Ask agent" feels immediate instead of waiting on the round-trip.
      const optimistic = buildOptimisticUserComment(threadId, body)
      setReviewThreads((current) =>
        current.map((thread) =>
          thread.id === threadId
            ? { ...thread, comments: [...thread.comments, optimistic] }
            : thread,
        ),
      )
      setReplyBodies((current) => ({ ...current, [threadId]: '' }))

      try {
        const comment = await addReviewThreadComment({ body, threadId })
        setReviewThreads((current) =>
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  comments: thread.comments.map((existing) =>
                    existing.id === optimistic.id ? comment : existing,
                  ),
                }
              : thread,
          ),
        )
      } catch (error) {
        setReviewThreads((current) =>
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  comments: thread.comments.filter(
                    (existing) => existing.id !== optimistic.id,
                  ),
                }
              : thread,
          ),
        )
        setReplyBodies((current) => ({ ...current, [threadId]: body }))
        setThreadErrors((current) => ({
          ...current,
          [threadId]: reviewThreadErrorMessage(error),
        }))
        setReplyingThreadId(null)
        return
      }

      setReplyingThreadId(null)
      await runAgentReplyForThread(threadId)
    },
    [replyBodies, runAgentReplyForThread],
  )

  const submitReviewThreadReply = useCallback(
    async (threadId: string) => {
      const body = replyBodies[threadId]?.trim() ?? ''

      if (!body) {
        setThreadErrors((current) => ({
          ...current,
          [threadId]: 'Enter a reply before posting.',
        }))
        return
      }

      setReplyingThreadId(threadId)
      setThreadErrors((current) => ({ ...current, [threadId]: '' }))

      // Optimistic: the reply appears instantly (dimmed) and the box clears;
      // the persisted comment replaces it on success, or it rolls back on error.
      const optimistic = buildOptimisticUserComment(threadId, body)
      setReviewThreads((current) =>
        current.map((thread) =>
          thread.id === threadId
            ? { ...thread, comments: [...thread.comments, optimistic] }
            : thread,
        ),
      )
      setReplyBodies((current) => ({ ...current, [threadId]: '' }))

      try {
        const comment = await addReviewThreadComment({ body, threadId })
        setReviewThreads((current) =>
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  comments: thread.comments.map((existing) =>
                    existing.id === optimistic.id ? comment : existing,
                  ),
                }
              : thread,
          ),
        )
      } catch (error) {
        setReviewThreads((current) =>
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  comments: thread.comments.filter(
                    (existing) => existing.id !== optimistic.id,
                  ),
                }
              : thread,
          ),
        )
        setReplyBodies((current) => ({ ...current, [threadId]: body }))
        setThreadErrors((current) => ({
          ...current,
          [threadId]: reviewThreadErrorMessage(error),
        }))
      } finally {
        setReplyingThreadId(null)
      }
    },
    [replyBodies],
  )

  /**
   * Asks the agent to implement the discussed change. Any text in the reply
   * box is an optional instruction. The returned thread has a pending
   * fix-proposal comment that the polling effect drives to completion.
   */
  const askAgentToFixInThread = useCallback(
    async (threadId: string) => {
      const instruction = replyBodies[threadId]?.trim() || undefined

      setAskingFixThreadId(threadId)
      setThreadErrors((current) => ({ ...current, [threadId]: '' }))

      try {
        const updated = await requestReviewThreadAgentFix({
          instruction,
          threadId,
        })
        setReviewThreads((current) =>
          current.map((thread) => (thread.id === threadId ? updated : thread)),
        )
        setReplyBodies((current) => ({ ...current, [threadId]: '' }))
      } catch (error) {
        setThreadErrors((current) => ({
          ...current,
          [threadId]: reviewThreadErrorMessage(error),
        }))
      } finally {
        setAskingFixThreadId(null)
      }
    },
    [replyBodies],
  )

  const approveFixInThread = useCallback(
    async (threadId: string, commentId: string) => {
      setFixAction({ commentId, kind: 'push' })
      setThreadErrors((current) => ({ ...current, [threadId]: '' }))

      try {
        const updated = await approveReviewThreadFix({ commentId, threadId })
        setReviewThreads((current) =>
          current.map((thread) => (thread.id === threadId ? updated : thread)),
        )
      } catch (error) {
        setThreadErrors((current) => ({
          ...current,
          [threadId]: reviewThreadErrorMessage(error),
        }))
      } finally {
        setFixAction(null)
      }
    },
    [],
  )

  const discardFixInThread = useCallback(
    async (threadId: string, commentId: string) => {
      setFixAction({ commentId, kind: 'discard' })
      setThreadErrors((current) => ({ ...current, [threadId]: '' }))

      try {
        const updated = await discardReviewThreadFix({ commentId, threadId })
        setReviewThreads((current) =>
          current.map((thread) => (thread.id === threadId ? updated : thread)),
        )
      } catch (error) {
        setThreadErrors((current) => ({
          ...current,
          [threadId]: reviewThreadErrorMessage(error),
        }))
      } finally {
        setFixAction(null)
      }
    },
    [],
  )

  const submitReviewThreadDraft = useCallback(async () => {
    if (!selectedFile) {
      setDraftError('Select a file before starting a thread.')
      return
    }

    if (!selectedThreadAnchor.ok) {
      setDraftError(selectedThreadAnchor.error)
      return
    }

    const body = draftBody.trim()

    if (!body) {
      setDraftError('Enter a comment before starting a thread.')
      return
    }

    setDraftError(null)
    setIsPostingDraft(true)

    try {
      const thread = await createReviewThread({
        anchorCommitSha: workspace.snapshot.headSha,
        anchorSnapshotId: workspace.snapshot.id,
        body,
        excerpt: selectedThreadAnchor.anchor.excerpt,
        filePath: selectedFile,
        lineEnd: selectedThreadAnchor.anchor.lineEnd,
        lineStart: selectedThreadAnchor.anchor.lineStart,
        number: workspace.snapshot.number,
        owner: workspace.snapshot.owner,
        repo: workspace.snapshot.repo,
        side: selectedThreadAnchor.anchor.side,
      })
      setReviewThreads((current) => [thread, ...current])
      clearSelectedReviewThreadDraft()
      // A thread-creating question goes to the agent by default.
      void runAgentReplyForThread(thread.id)
    } catch (error) {
      setDraftError(reviewThreadErrorMessage(error))
    } finally {
      setIsPostingDraft(false)
    }
  }, [
    clearSelectedReviewThreadDraft,
    draftBody,
    runAgentReplyForThread,
    selectedFile,
    selectedThreadAnchor,
    workspace.snapshot.headSha,
    workspace.snapshot.id,
    workspace.snapshot.number,
    workspace.snapshot.owner,
    workspace.snapshot.repo,
  ])

  // Pin the current selection as a reference for a multi-anchor discussion,
  // then clear it so the next range can be selected. Pins accumulate in the
  // discussion composer.
  const pinCurrentSelection = useCallback(() => {
    if (!selectedFile || !selectedThreadAnchor.ok) {
      if (!selectedThreadAnchor.ok) {
        setDraftError(selectedThreadAnchor.error)
      }
      return
    }

    const anchor = selectedThreadAnchor.anchor
    setPinnedAnchors((current) => [
      ...current,
      {
        anchorCommitSha: workspace.snapshot.headSha,
        excerpt: anchor.excerpt,
        filePath: selectedFile,
        lineEnd: anchor.lineEnd,
        lineStart: anchor.lineStart,
        side: anchor.side,
      },
    ])
    clearSelectedReviewThreadDraft()
  }, [
    clearSelectedReviewThreadDraft,
    selectedFile,
    selectedThreadAnchor,
    workspace.snapshot.headSha,
  ])

  const removePinnedAnchor = useCallback((index: number) => {
    setPinnedAnchors((current) =>
      current.filter((_, position) => position !== index),
    )
  }, [])

  const clearPinnedDiscussion = useCallback(() => {
    setPinnedAnchors([])
    setDiscussionBody('')
    setDiscussionError(null)
  }, [])

  // Create a discussion thread from the pinned selections: the first pin is the
  // primary anchor, the rest ride along as extraAnchors, and the agent prompt
  // includes every excerpt.
  const submitPinnedDiscussion = useCallback(async () => {
    if (pinnedAnchors.length === 0) {
      setDiscussionError('Pin at least one selection first.')
      return
    }

    const body = discussionBody.trim()
    if (!body) {
      setDiscussionError('Enter a question about the pinned selections.')
      return
    }

    const [primary, ...extra] = pinnedAnchors
    setDiscussionError(null)
    setIsPostingDiscussion(true)

    try {
      const thread = await createReviewThread({
        anchorCommitSha: primary.anchorCommitSha,
        anchorSnapshotId: workspace.snapshot.id,
        body,
        excerpt: primary.excerpt,
        extraAnchors: extra,
        filePath: primary.filePath,
        kind: 'discussion',
        lineEnd: primary.lineEnd,
        lineStart: primary.lineStart,
        number: workspace.snapshot.number,
        owner: workspace.snapshot.owner,
        repo: workspace.snapshot.repo,
        side: primary.side,
      })
      setReviewThreads((current) => [thread, ...current])
      clearPinnedDiscussion()
      // Land in the Discussions tab so the new conversation is where the user
      // is looking, not buried at its anchor in the diff.
      setSelectedView('discussions')
      void runAgentReplyForThread(thread.id)
    } catch (error) {
      setDiscussionError(reviewThreadErrorMessage(error))
    } finally {
      setIsPostingDiscussion(false)
    }
  }, [
    clearPinnedDiscussion,
    discussionBody,
    pinnedAnchors,
    runAgentReplyForThread,
    workspace.snapshot.id,
    workspace.snapshot.number,
    workspace.snapshot.owner,
    workspace.snapshot.repo,
  ])

  const draftAnnotation = useMemo(
    () =>
      selectedFile && selectedThreadAnchor.ok
        ? ({
            anchor: selectedThreadAnchor.anchor,
            body: draftBody,
            error: draftError,
            isSubmitting: isPostingDraft,
            kind: 'draft' as const,
            onBodyChange: setDraftBody,
            onCancel: clearSelectedReviewThreadDraft,
            onPinSelection: pinCurrentSelection,
            onSubmit: submitReviewThreadDraft,
          } satisfies Extract<ReviewThreadAnnotationData, { kind: 'draft' }>)
        : null,
    [
      clearSelectedReviewThreadDraft,
      draftBody,
      draftError,
      isPostingDraft,
      pinCurrentSelection,
      selectedFile,
      selectedThreadAnchor,
      submitReviewThreadDraft,
    ],
  )
  const threadAnnotationHandlers = useMemo(
    () => ({
      agentActivity,
      askingFixThreadId,
      fixAction,
      replyBodies,
      replyingThreadId,
      threadErrors,
      updatingStatusThreadId,
      onApproveFix: approveFixInThread,
      onAskAgent: askAgentInThread,
      onAskFix: askAgentToFixInThread,
      onDiscardFix: discardFixInThread,
      onReplyBodyChange: updateReplyBody,
      onReplySubmit: submitReviewThreadReply,
      onStatusChange: updateReviewThreadStatusFromAnnotation,
    }),
    [
      agentActivity,
      approveFixInThread,
      askAgentInThread,
      askAgentToFixInThread,
      askingFixThreadId,
      discardFixInThread,
      fixAction,
      replyBodies,
      replyingThreadId,
      threadErrors,
      updateReplyBody,
      updateReviewThreadStatusFromAnnotation,
      submitReviewThreadReply,
      updatingStatusThreadId,
    ],
  )
  const reviewThreadAnnotations = useMemo(
    () =>
      buildReviewThreadAnnotations({
        ...threadAnnotationHandlers,
        draft: draftAnnotation,
        threads: visibleThreads,
      }),
    [draftAnnotation, threadAnnotationHandlers, visibleThreads],
  )
  const getGuideFileAnnotations = useCallback(
    (filePath: string) =>
      buildReviewThreadAnnotations({
        ...threadAnnotationHandlers,
        draft: selectedFile === filePath ? draftAnnotation : null,
        threads: threadsByFile.get(filePath) ?? [],
      }),
    [draftAnnotation, selectedFile, threadAnnotationHandlers, threadsByFile],
  )
  const discussionAnnotations = useMemo(
    () =>
      discussionThreads.map((thread) =>
        buildReviewThreadMetadata(thread, threadAnnotationHandlers, {
          onJumpToAnchor: jumpToAnchor,
          variant: 'discussion',
        }),
      ),
    [discussionThreads, jumpToAnchor, threadAnnotationHandlers],
  )
  const getGuideFileSelectedLines = useCallback(
    (filePath: string) => (selectedFile === filePath ? selectedLines : null),
    [selectedFile, selectedLines],
  )

  const renderGuideSectionRef = useCallback(
    (sectionId: string) => (node: HTMLElement | null) => {
      if (node) {
        guideSectionRefs.current.set(sectionId, node)
        return
      }

      guideSectionRefs.current.delete(sectionId)
    },
    [],
  )

  const renderGuideFileRef = useCallback(
    (filePath: string) => (node: HTMLElement | null) => {
      if (node) {
        guideFileRefs.current.set(filePath, node)
        return
      }

      guideFileRefs.current.delete(filePath)
    },
    [],
  )

  return (
    <section className="flex h-[calc(100vh-57px)] min-h-[680px] flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-2">
          <GitPullRequestArrow className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {workspace.snapshot.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {workspace.snapshot.owner}/{workspace.snapshot.repo} · #
              {workspace.snapshot.number} · {workspace.snapshot.baseRef} →{' '}
              {workspace.snapshot.headRef}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            <ModeButton
              active={selectedView === 'guide'}
              disabled={
                !workspace.guide &&
                workspace.state !== 'imported' &&
                workspace.state !== 'preparing' &&
                workspace.state !== 'failed'
              }
              icon={<ListTree className="size-3.5" />}
              label="Guide"
              onClick={() => setSelectedView('guide')}
            />
            <ModeButton
              active={selectedView === 'diff'}
              icon={<GitCompareArrows className="size-3.5" />}
              label="Diff"
              onClick={() => setSelectedView('diff')}
            />
            <ModeButton
              active={selectedView === 'discussions'}
              icon={<MessagesSquare className="size-3.5" />}
              label={
                discussionThreads.length > 0
                  ? `Discussions (${discussionThreads.length})`
                  : 'Discussions'
              }
              onClick={() => setSelectedView('discussions')}
            />
          </div>
          <Badge tone="success">{workspace.files.length} files</Badge>
          {workspace.guide ? (
            <Badge tone="warning">
              {workspace.guide.sections.length} sections
            </Badge>
          ) : null}
          <PullRequestStatusBadge status={workspace.prStatus} />
          <WorkspaceStatusBadge workspace={workspace} />
          <Button
            asChild
            className="h-8 gap-1.5 px-2 text-xs"
            size="sm"
            variant="outline"
          >
            <a href={workspace.snapshot.url} rel="noreferrer" target="_blank">
              <GitPullRequestArrow className="size-3.5" />
              Pull Request
            </a>
          </Button>
        </div>
      </div>

      {pinnedAnchors.length > 0 ? (
        <PinnedDiscussionComposer
          body={discussionBody}
          error={discussionError}
          isSubmitting={isPostingDiscussion}
          onBodyChange={setDiscussionBody}
          onClear={clearPinnedDiscussion}
          onRemovePin={removePinnedAnchor}
          onSubmit={submitPinnedDiscussion}
          pins={pinnedAnchors}
        />
      ) : null}

      {selectedView === 'discussions' ? (
        <DiscussionsView
          annotations={discussionAnnotations}
          onBrowseDiff={() => setSelectedView('diff')}
        />
      ) : (
        <div
          className={cn(
            'relative grid min-h-0 flex-1 overflow-hidden',
            selectedView === 'guide' && guideSectionListCollapsed
              ? 'grid-rows-[40px_minmax(0,1fr)] lg:grid-cols-[56px_minmax(0,1fr)] lg:grid-rows-1'
              : 'grid-rows-[minmax(180px,280px)_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1',
          )}
        >
          {selectedView === 'guide' ? (
            <>
              <GuideRail
                activeSectionId={effectiveActiveGuideSectionId}
                autoGenerate={autoGenerate}
                onGenerationStart={markGenerationStarted}
                onSelectSection={handleSelectGuideSection}
                onToggleSectionList={() =>
                  setGuideSectionListCollapsed((collapsed) => !collapsed)
                }
                sectionListCollapsed={guideSectionListCollapsed}
                workspace={workspace}
              />
              {workspace.state === 'preparing' ? (
                <GuidePreparingPane />
              ) : workspace.guide ? (
                <GuideView
                  getFileAnnotations={getGuideFileAnnotations}
                  getFileDiff={(filePath) => diffByPath.get(filePath) ?? ''}
                  getFileSelectedLines={getGuideFileSelectedLines}
                  guide={workspace.guide}
                  isFileLoading={() => false}
                  onFileSelectedLinesChange={handleFileSelectedLinesChange}
                  onSelectFile={handleSelectGuideFile}
                  renderAnnotation={(annotation) => (
                    <ReviewThreadAnnotation annotation={annotation.metadata} />
                  )}
                  renderFileRef={renderGuideFileRef}
                  renderSectionRef={renderGuideSectionRef}
                />
              ) : (
                <GuideEmptyPane workspace={workspace} />
              )}
            </>
          ) : (
            <>
              <FileRail
                files={workspace.files}
                onSelectFile={handleSelectFile}
                onStatusFilterChange={handleStatusFilterChange}
                selectedFile={selectedVisibleFile}
                statusCounts={statusCounts}
                statusFilter={statusFilter}
                visibleFiles={visibleFiles}
              />
              <main className="min-w-0 overflow-hidden">
                {reviewThreadLoadError ? (
                  <div className="border-b border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-xs text-[var(--danger)]">
                    {reviewThreadLoadError}
                  </div>
                ) : null}
                <PierreDiffViewer
                  diff={selectedDiff}
                  file={selectedFile}
                  fileStatus={selectedFileStatus}
                  lineAnnotations={reviewThreadAnnotations}
                  onSelectedLinesChange={
                    selectedFile
                      ? (range) =>
                          handleFileSelectedLinesChange(selectedFile, range)
                      : undefined
                  }
                  renderAnnotation={(annotation) => (
                    <ReviewThreadAnnotation annotation={annotation.metadata} />
                  )}
                  selectedLines={selectedLines}
                  title="Pull request diff"
                />
              </main>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function countFilesByStatus(files: ReviewFile[]): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const file of files) {
    counts[file.status] = (counts[file.status] ?? 0) + 1
  }

  return counts
}

interface ReviewThreadMetadataInput {
  agentActivity: string | null
  askingFixThreadId: string | null
  fixAction: { commentId: string; kind: 'push' | 'discard' } | null
  onApproveFix: (threadId: string, commentId: string) => void
  onAskAgent: (threadId: string) => void
  onAskFix: (threadId: string) => void
  onDiscardFix: (threadId: string, commentId: string) => void
  onReplyBodyChange: (threadId: string, body: string) => void
  onReplySubmit: (threadId: string) => void
  onStatusChange: (threadId: string, status: 'open' | 'resolved') => void
  replyingThreadId: string | null
  replyBodies: Record<string, string>
  threadErrors: Record<string, string>
  updatingStatusThreadId: string | null
}

/**
 * Build the thread-annotation view model for a single thread. Shared by the
 * inline diff annotations and the Discussions surface; `extras` switches the
 * card to its discussion presentation (reference chips + jump-to-anchor).
 */
function buildReviewThreadMetadata(
  thread: ReviewThread,
  input: ReviewThreadMetadataInput,
  extras?: {
    onJumpToAnchor?: (anchor: ReviewThreadAnchorRef) => void
    variant?: 'inline' | 'discussion'
  },
): Extract<ReviewThreadAnnotationData, { kind: 'thread' }> {
  const hasPendingAgentComment = thread.comments.some(isAgentReplyInFlight)

  return {
    agentActivity: hasPendingAgentComment ? input.agentActivity : null,
    error: input.threadErrors[thread.id] || null,
    fixActionCommentId: input.fixAction?.commentId ?? null,
    isAskingAgent: hasPendingAgentComment,
    isAskingFix: input.askingFixThreadId === thread.id,
    isDiscardingFix: input.fixAction?.kind === 'discard',
    isPushingFix: input.fixAction?.kind === 'push',
    isReplying: input.replyingThreadId === thread.id,
    isUpdatingStatus: input.updatingStatusThreadId === thread.id,
    kind: 'thread',
    replyBody: input.replyBodies[thread.id] ?? '',
    thread,
    onApproveFix: (commentId) => input.onApproveFix(thread.id, commentId),
    onAskAgent: () => input.onAskAgent(thread.id),
    onAskFix: () => input.onAskFix(thread.id),
    onDiscardFix: (commentId) => input.onDiscardFix(thread.id, commentId),
    onJumpToAnchor: extras?.onJumpToAnchor,
    onReplyBodyChange: (body) => input.onReplyBodyChange(thread.id, body),
    onReplySubmit: () => input.onReplySubmit(thread.id),
    onStatusChange: (status) => input.onStatusChange(thread.id, status),
    variant: extras?.variant ?? 'inline',
  }
}

function buildReviewThreadAnnotations(
  input: ReviewThreadMetadataInput & {
    draft: Extract<ReviewThreadAnnotationData, { kind: 'draft' }> | null
    threads: ReviewThread[]
  },
): DiffLineAnnotation<ReviewThreadAnnotationData>[] {
  const annotations: DiffLineAnnotation<ReviewThreadAnnotationData>[] =
    input.threads.map((thread) => ({
      lineNumber: thread.lineStart,
      metadata: buildReviewThreadMetadata(thread, input),
      side: pierreSideFromReviewThreadDiffSide(thread.side),
    }))

  if (input.draft) {
    annotations.push({
      lineNumber: input.draft.anchor.lineEnd,
      metadata: input.draft,
      side: pierreSideFromReviewThreadDiffSide(input.draft.anchor.side),
    })
  }

  return annotations
}

// Monotonic suffix so each optimistic comment gets a stable, unique id without
// relying on timestamps or randomness.
let optimisticCommentSeq = 0

/**
 * A placeholder for the user's just-submitted comment, shown immediately while
 * the real one is persisted. `pending` dims it; on success it is swapped for the
 * server record, on failure it is removed.
 */
function buildOptimisticUserComment(
  threadId: string,
  body: string,
): ReviewThread['comments'][number] {
  optimisticCommentSeq += 1

  return {
    id: `optimistic-${threadId}-${optimisticCommentSeq}`,
    threadId,
    authorType: 'user',
    authorUserId: null,
    authorName: null,
    body,
    agentState: null,
    commentKind: 'message',
    fixState: null,
    commitSha: null,
    createdAt: new Date().toISOString(),
    pending: true,
  }
}

function reviewThreadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Review threads unavailable.'
}

/**
 * An agent reply still in flight — freshly queued ('pending') or streaming its
 * partial answer in ('streaming'). Both keep the thread polling until the turn
 * finishes.
 */
function isAgentReplyInFlight(
  comment: ReviewThread['comments'][number],
): boolean {
  return (
    comment.authorType === 'agent' &&
    (comment.agentState === 'pending' || comment.agentState === 'streaming')
  )
}
