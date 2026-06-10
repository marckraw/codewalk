'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GitCompareArrows, GitPullRequestArrow, ListTree } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FileRail } from './file-rail'
import { GuideEmptyPane } from './guide-empty-pane'
import { GuidePreparingPane } from './guide-preparing-pane'
import { GuideRail } from './guide-rail'
import { GuideView } from './guide-view'
import { ModeButton } from './mode-button'
import { PierreDiffViewer } from './pierre-diff-viewer'
import { PullRequestStatusBadge } from './pull-request-status-badge'
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
    if (
      deepLink.sectionId &&
      initialWorkspace.guide?.sections.some(
        (section) => section.id === deepLink.sectionId,
      )
    ) {
      return deepLink.sectionId
    }

    return initialWorkspace.guide?.sections[0]?.id ?? null
  })
  const guideSectionRefs = useRef(new Map<string, HTMLElement>())
  const guideFileRefs = useRef(new Map<string, HTMLElement>())
  const hasAppliedInitialDeepLink = useRef(false)

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
    if (!workspace.guide || workspace.guide.sections.length === 0) {
      return null
    }

    if (
      activeGuideSectionId &&
      workspace.guide.sections.some(
        (section) => section.id === activeGuideSectionId,
      )
    ) {
      return activeGuideSectionId
    }

    return workspace.guide.sections[0].id
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

  useEffect(() => {
    if (
      selectedView !== 'guide' ||
      !workspace.guide ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }

    const observedSections = workspace.guide.sections
      .map((section) => ({
        id: section.id,
        node: guideSectionRefs.current.get(section.id),
      }))
      .filter(
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

  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedFile(filePath)
  }, [])

  const handleStatusFilterChange = useCallback((nextFilter: string) => {
    setStatusFilter(nextFilter)
    setSelectedFile(null)
  }, [])

  const handleSelectGuideSection = useCallback((sectionId: string) => {
    setActiveGuideSectionId(sectionId)
    guideSectionRefs.current
      .get(sectionId)
      ?.scrollIntoView({ block: 'start', inline: 'nearest' })
  }, [])

  const handleSelectGuideFile = useCallback((filePath: string) => {
    setSelectedFile(filePath)
    guideFileRefs.current
      .get(filePath)
      ?.scrollIntoView({ block: 'start', inline: 'nearest' })
  }, [])

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

      <div className="relative grid min-h-0 flex-1 grid-rows-[minmax(180px,280px)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
        {selectedView === 'guide' ? (
          <>
            <GuideRail
              activeSectionId={effectiveActiveGuideSectionId}
              autoGenerate={autoGenerate}
              onGenerationStart={markGenerationStarted}
              onSelectSection={handleSelectGuideSection}
              workspace={workspace}
            />
            {workspace.state === 'preparing' ? (
              <GuidePreparingPane />
            ) : workspace.guide ? (
              <GuideView
                getFileDiff={(filePath) => diffByPath.get(filePath) ?? ''}
                guide={workspace.guide}
                isFileLoading={() => false}
                onSelectFile={handleSelectGuideFile}
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
              <PierreDiffViewer
                diff={selectedDiff}
                file={selectedFile}
                fileStatus={selectedFileStatus}
                title="Pull request diff"
              />
            </main>
          </>
        )}
      </div>
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
