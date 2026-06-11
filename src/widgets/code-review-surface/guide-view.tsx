import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/button'
import { MarkdownText } from './markdown'
import { GuideFileDiff } from './guide-file-diff'
import { RiskBadge } from './risk-badge'
import type { ReviewGuide, ReviewGuideSection } from './review-types'

interface GuideViewProps {
  getFileDiff: (filePath: string) => string
  guide: ReviewGuide
  isFileLoading: (filePath: string) => boolean
  onSelectFile: (filePath: string) => void
  renderFileRef: (filePath: string) => (node: HTMLElement | null) => void
  renderSectionRef: (sectionId: string) => (node: HTMLElement | null) => void
}

export function GuideView({
  getFileDiff,
  guide,
  isFileLoading,
  onSelectFile,
  renderFileRef,
  renderSectionRef,
}: GuideViewProps) {
  if (guide.sections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
        No changed files detected for this guide.
      </div>
    )
  }

  return (
    <main className="app-scrollbar h-full min-w-0 overflow-y-auto bg-background">
      <div className="flex min-h-full flex-col">
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
                  loading={isFileLoading(file.path)}
                  renderRef={renderFileRef(file.path)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
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
