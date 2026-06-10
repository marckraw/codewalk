import type { ReviewGuideFile } from './review-types'
import { PierreDiffViewer } from './pierre-diff-viewer'

interface GuideFileDiffProps {
  diff: string
  file: ReviewGuideFile
  loading: boolean
  renderRef: (node: HTMLElement | null) => void
}

export function GuideFileDiff({
  diff,
  file,
  loading,
  renderRef,
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
          loading={loading}
          status={file.status}
          subtitle={file.reason}
          subtitleVariant="description"
        />
      </div>
    </article>
  )
}
