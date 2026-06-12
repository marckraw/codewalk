import type { ReactNode } from 'react'
import type { DiffLineAnnotation, SelectedLineRange } from '@pierre/diffs'
import type { ReviewGuideFile } from './review-types'
import { PierreDiffViewer } from './pierre-diff-viewer'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'

interface GuideFileDiffProps {
  diff: string
  file: ReviewGuideFile
  lineAnnotations?: DiffLineAnnotation<ReviewThreadAnnotationData>[]
  loading: boolean
  onSelectedLinesChange?: (range: SelectedLineRange | null) => void
  renderAnnotation?: (
    annotation: DiffLineAnnotation<ReviewThreadAnnotationData>,
  ) => ReactNode
  renderRef: (node: HTMLElement | null) => void
  selectedLines?: SelectedLineRange | null
}

export function GuideFileDiff({
  diff,
  file,
  lineAnnotations,
  loading,
  onSelectedLinesChange,
  renderAnnotation,
  renderRef,
  selectedLines,
}: GuideFileDiffProps) {
  return (
    <article
      ref={renderRef}
      className="min-w-0 scroll-mt-5 border border-border bg-card"
    >
      <div className="h-[560px] min-h-0">
        <PierreDiffViewer
          diff={diff}
          emptyMessage="No patch was captured for this file."
          file={file.path}
          fileStatus={file.status}
          lineAnnotations={lineAnnotations}
          loading={loading}
          onSelectedLinesChange={onSelectedLinesChange}
          renderAnnotation={renderAnnotation}
          selectedLines={selectedLines}
          status={file.status}
          subtitle={file.reason}
          subtitleVariant="description"
        />
      </div>
    </article>
  )
}
