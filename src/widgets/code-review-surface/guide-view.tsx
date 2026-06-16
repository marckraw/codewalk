import type { ReactNode } from 'react'
import type { DiffLineAnnotation, SelectedLineRange } from '@pierre/diffs'
import { Sparkles } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { MarkdownText } from './markdown'
import { GuideFileDiff } from './guide-file-diff'
import {
  GUIDE_OVERVIEW_SECTION_ID,
  guideOverviewTitle,
  hasGuideOverview,
} from './guide-overview.pure'
import { RiskBadge } from './risk-badge'
import type { ReviewGuide, ReviewGuideSection } from './review-types'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'

interface GuideViewProps {
  getFileAnnotations?: (
    filePath: string,
  ) => DiffLineAnnotation<ReviewThreadAnnotationData>[]
  getFileDiff: (filePath: string) => string
  getFileSelectedLines?: (filePath: string) => SelectedLineRange | null
  guide: ReviewGuide
  isFileLoading: (filePath: string) => boolean
  onFileSelectedLinesChange?: (
    filePath: string,
    range: SelectedLineRange | null,
  ) => void
  onSelectFile: (filePath: string) => void
  renderAnnotation?: (
    annotation: DiffLineAnnotation<ReviewThreadAnnotationData>,
  ) => ReactNode
  renderFileRef: (filePath: string) => (node: HTMLElement | null) => void
  renderSectionRef: (sectionId: string) => (node: HTMLElement | null) => void
}

export function GuideView({
  getFileAnnotations,
  getFileDiff,
  getFileSelectedLines,
  guide,
  isFileLoading,
  onFileSelectedLinesChange,
  onSelectFile,
  renderAnnotation,
  renderFileRef,
  renderSectionRef,
}: GuideViewProps) {
  const showOverview = hasGuideOverview(guide.overview)

  if (guide.sections.length === 0 && !showOverview) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
        No changed files detected for this guide.
      </div>
    )
  }

  return (
    <main className="app-scrollbar h-full min-w-0 overflow-y-auto bg-background">
      <div className="flex min-h-full flex-col">
        {showOverview ? renderOverviewSection(guide, renderSectionRef) : null}
        {guide.sections.map((section, index) => (
          <section
            key={section.id}
            ref={renderSectionRef(section.id)}
            className="grid min-h-full min-w-0 scroll-mt-0 gap-5 border-b border-border px-5 py-5 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]"
          >
            <div className="self-start bg-background py-1 xl:sticky xl:top-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {String(index + 1).padStart(2, '0')} /{' '}
                    {String(guide.sections.length).padStart(2, '0')}
                  </p>
                  <h2 className="mt-3 text-2xl leading-8 font-semibold">
                    {section.title}
                  </h2>
                  <MarkdownText
                    className="mt-3 text-sm leading-6 text-muted-foreground"
                    content={section.summary}
                  />
                </div>
                <RiskBadge section={section} />
              </div>
              <MarkdownText
                className="mt-5 text-sm leading-6 text-foreground"
                content={section.narrative}
              />
              <div className="mt-5 flex flex-col gap-1.5">
                {section.files.map((file) => (
                  <Button
                    key={file.path}
                    className="h-8 w-full justify-between gap-2 px-2 font-mono text-[11px]"
                    onClick={() => onSelectFile(file.path)}
                    size="sm"
                    title={file.path}
                    type="button"
                    variant="outline"
                  >
                    <span className="min-w-0 truncate">{file.path}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {file.status}
                    </span>
                  </Button>
                ))}
              </div>
              {renderChecklist(section)}
            </div>
            <div className="flex min-w-0 flex-col gap-4 pb-5">
              {section.files.map((file) => (
                <GuideFileDiff
                  key={file.path}
                  diff={getFileDiff(file.path)}
                  file={file}
                  lineAnnotations={getFileAnnotations?.(file.path)}
                  loading={isFileLoading(file.path)}
                  onSelectedLinesChange={
                    onFileSelectedLinesChange
                      ? (range) => onFileSelectedLinesChange(file.path, range)
                      : undefined
                  }
                  renderAnnotation={renderAnnotation}
                  renderRef={renderFileRef(file.path)}
                  selectedLines={getFileSelectedLines?.(file.path)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

/**
 * The "00" grounding pane. It sits above the numbered sections and surfaces the
 * guide's whole-PR overview so the reviewer knows what the change is for before
 * walking the per-file sections. Unlike a real section it carries no risk, files,
 * or checklist, so it renders full-width with an intro marker instead of a risk
 * badge — but it registers the same section ref so rail selection, scrolling,
 * active-tracking, and deep-linking treat it like any other section.
 */
function renderOverviewSection(
  guide: ReviewGuide,
  renderSectionRef: (sectionId: string) => (node: HTMLElement | null) => void,
): ReactNode {
  return (
    <section
      ref={renderSectionRef(GUIDE_OVERVIEW_SECTION_ID)}
      className="min-w-0 scroll-mt-0 border-b border-border px-5 py-5"
    >
      <div className="max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              {`00 / ${String(guide.sections.length).padStart(2, '0')}`}
            </p>
            <h2 className="mt-3 text-2xl leading-8 font-semibold">
              {guideOverviewTitle(guide.pullRequest)}
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-[var(--panel-subtle)] px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            <Sparkles className="size-3" />
            Overview
          </span>
        </div>
        <MarkdownText
          className="mt-5 text-sm leading-7 text-foreground"
          content={guide.overview}
        />
      </div>
    </section>
  )
}

function renderChecklist(section: ReviewGuideSection): ReactNode {
  if (section.checklist.length === 0) {
    return null
  }

  return (
    <div className="mt-3 grid gap-1">
      {section.checklist.map((item) => (
        <div
          key={item}
          className="flex min-w-0 items-start gap-2 text-[11px] leading-5 text-muted-foreground"
        >
          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
          <MarkdownText className="text-[11px] leading-5" content={item} />
        </div>
      ))}
    </div>
  )
}
