'use client'

import { useMemo, type ReactNode } from 'react'
import {
  getFiletypeFromFileName,
  type DiffLineAnnotation,
  type SelectedLineRange,
  type SupportedLanguages,
} from '@pierre/diffs'
import {
  PatchDiff,
  Virtualizer,
  WorkerPoolContextProvider,
} from '@pierre/diffs/react'
import { Loader2 } from 'lucide-react'
import { useAppColorScheme } from './use-app-color-scheme'
import { PierreDiffErrorBoundary } from './pierre-diff-error-boundary'
import { planPierreDiffPerformance } from './pierre-diff-performance.pure'
import { describeMissingPierrePatch } from './pierre-diff-viewer.pure'

interface PierreDiffViewerProps<TAnnotation = undefined> {
  diff: string
  emptyMessage?: string
  file: string | null
  fileStatus?: string | null
  lineAnnotations?: DiffLineAnnotation<TAnnotation>[]
  loading?: boolean
  onSelectedLinesChange?: (range: SelectedLineRange | null) => void
  renderAnnotation?: (annotation: DiffLineAnnotation<TAnnotation>) => ReactNode
  selectedLines?: SelectedLineRange | null
  title?: string
}

export function PierreDiffViewer<TAnnotation>({
  diff,
  emptyMessage = 'Select a changed file to inspect its pull request diff.',
  file,
  fileStatus = null,
  lineAnnotations = [],
  loading = false,
  onSelectedLinesChange,
  renderAnnotation,
  selectedLines = null,
  title = 'Pull request diff',
}: PierreDiffViewerProps<TAnnotation>) {
  const colorScheme = useAppColorScheme()
  const pierreTheme = colorScheme === 'dark' ? 'pierre-dark' : 'pierre-light'
  const performancePlan = useMemo(() => planPierreDiffPerformance(diff), [diff])
  const patch = useMemo(
    () => (file ? buildPierrePatch({ diff, file }) : null),
    [diff, file],
  )
  const canUseWorkerPool =
    performancePlan.useWorkerPool && canUsePierreDiffWorkerPool()
  const workerPoolOptions = useMemo(
    () => ({
      poolSize: getPierreDiffWorkerPoolSize(),
      workerFactory: createPierreDiffWorker,
    }),
    [],
  )
  const workerHighlighterOptions = useMemo(
    () => ({
      langs: [getPierreDiffLanguageHint(file ?? '')],
      preferredHighlighter: 'shiki-js' as const,
    }),
    [file],
  )

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  if (loading && !diff) {
    return (
      <div aria-busy="true" className="flex h-full min-h-0 flex-col">
        {renderDiffHeader({ file, loading, title })}
        <div className="app-scrollbar min-h-0 flex-1 overflow-auto bg-background/60">
          <div className="flex h-full min-h-32 items-center justify-center gap-2 p-3 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Loading diff...</span>
          </div>
        </div>
      </div>
    )
  }

  const patchDiff = patch ? (
    <PatchDiff
      disableWorkerPool={!canUseWorkerPool}
      lineAnnotations={lineAnnotations}
      options={{
        disableFileHeader: true,
        enableLineSelection: Boolean(onSelectedLinesChange),
        lineHoverHighlight: onSelectedLinesChange ? 'line' : 'disabled',
        onLineSelected: onSelectedLinesChange,
        onLineSelectionEnd: onSelectedLinesChange,
        // Single theme name (not the light/dark pair) so Pierre emits direct
        // colors and follows the app theme instead of the OS `prefers-color-scheme`.
        theme: pierreTheme,
      }}
      patch={patch}
      renderAnnotation={renderAnnotation}
      selectedLines={selectedLines}
    />
  ) : null
  const diffNode =
    patchDiff && canUseWorkerPool ? (
      <WorkerPoolContextProvider
        highlighterOptions={workerHighlighterOptions}
        poolOptions={workerPoolOptions}
      >
        {patchDiff}
      </WorkerPoolContextProvider>
    ) : (
      patchDiff
    )
  const diffContent = patchDiff
    ? renderPierreDiffPerformanceShell({
        children: diffNode,
        virtualize: performancePlan.virtualize,
      })
    : null

  const missingMessage = diffContent
    ? null
    : describeMissingPierrePatch({ diff, fileStatus })

  return (
    <div aria-busy={loading} className="flex h-full min-h-0 flex-col">
      {renderDiffHeader({ file, loading, title })}
      <div className="app-scrollbar min-h-0 flex-1 overflow-auto bg-background/60">
        {diffContent ? (
          <PierreDiffErrorBoundary fallback={renderRawDiffFallback(diff, true)}>
            {diffContent}
          </PierreDiffErrorBoundary>
        ) : missingMessage ? (
          <div className="flex h-full min-h-32 items-center justify-center p-3 text-center text-xs text-muted-foreground">
            {missingMessage}
          </div>
        ) : (
          renderRawDiffFallback(diff, false)
        )}
      </div>
    </div>
  )
}

function renderRawDiffFallback(diff: string, afterError: boolean) {
  return (
    <div className="p-3">
      {afterError ? (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Couldn’t render this diff — showing the raw patch.
        </p>
      ) : null}
      <pre className="overflow-x-auto font-mono text-[11px] whitespace-pre text-muted-foreground">
        {diff.trim() || '(no diff available)'}
      </pre>
    </div>
  )
}

export type { PierreDiffViewerProps }

function renderDiffHeader({
  file,
  loading = false,
  title,
}: {
  file: string
  loading?: boolean
  title: string
}) {
  return (
    <div className="shrink-0 border-b border-border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <p
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground"
          title={file}
        >
          {file}
        </p>
        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wider">
        {title}
      </p>
    </div>
  )
}

function renderPierreDiffPerformanceShell({
  children,
  virtualize,
}: {
  children: ReactNode
  virtualize: boolean
}) {
  if (!virtualize) {
    return children
  }

  return (
    <Virtualizer
      className="h-full min-h-0"
      config={{ intersectionObserverMargin: 1200, overscrollSize: 800 }}
      contentClassName="min-h-full"
    >
      {children}
    </Virtualizer>
  )
}

export function buildPierrePatch(input: {
  diff: string
  file: string
}): string | null {
  const diff = input.diff.trimEnd()
  if (!diff || !diff.includes('@@')) {
    return null
  }

  if (
    diff.startsWith('diff --git ') ||
    diff.startsWith('--- ') ||
    diff.includes('\n--- ')
  ) {
    return diff
  }

  return [
    `diff --git a/${input.file} b/${input.file}`,
    `--- a/${input.file}`,
    `+++ b/${input.file}`,
    diff,
  ].join('\n')
}

function canUsePierreDiffWorkerPool(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined'
}

function createPierreDiffWorker(): Worker {
  return new Worker(
    new URL('@pierre/diffs/worker/worker.js', import.meta.url),
    {
      name: 'pierre-diffs',
      type: 'module',
    },
  )
}

function getPierreDiffWorkerPoolSize(): number {
  if (typeof window === 'undefined') {
    return 1
  }

  const cores = window.navigator.hardwareConcurrency || 2
  return Math.max(1, Math.min(4, cores - 1))
}

function getPierreDiffLanguageHint(file: string): SupportedLanguages {
  return getFiletypeFromFileName(file)
}
