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
      <div className="border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {file.status}
          </span>
          <p className="min-w-0 flex-1 truncate font-mono text-xs">
            {file.path}
          </p>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {file.reason}
        </p>
      </div>
      <div className="h-[560px] min-h-0">
        <PierreDiffViewer
          diff={diff}
          emptyMessage="No patch was captured for this file."
          file={file.path}
          fileStatus={file.status}
          loading={loading}
          showHeader={false}
          title="Guide section diff"
        />
      </div>
    </article>
  )
}
