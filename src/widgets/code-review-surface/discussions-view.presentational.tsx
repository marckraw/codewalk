import { GitCompareArrows, MessagesSquare } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { ReviewThreadAnnotation } from './review-thread-annotation.presentational'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'

/**
 * The Discussions surface: whole-PR conversations with the agent, decoupled
 * from inline diff threads. Each card lists the pinned selections it references
 * as chips that jump back into the diff.
 */
export function DiscussionsView({
  annotations,
  onBrowseDiff,
}: {
  annotations: Extract<ReviewThreadAnnotationData, { kind: 'thread' }>[]
  onBrowseDiff: () => void
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MessagesSquare
                aria-hidden="true"
                className="size-4 text-sky-500"
              />
              Discussions
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Conversations about the whole pull request. Pin selections in the
              diff to ground a new discussion.
            </p>
          </div>
          <Button
            className="h-8 shrink-0 gap-1.5 px-2 text-xs"
            onClick={onBrowseDiff}
            size="sm"
            type="button"
            variant="outline"
          >
            <GitCompareArrows className="size-3.5" />
            Browse diff
          </Button>
        </div>

        {annotations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-10 text-center">
            <MessagesSquare
              aria-hidden="true"
              className="size-6 text-muted-foreground"
            />
            <p className="text-sm font-medium">No discussions yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Open the diff, select one or more ranges, pin them, and ask the
              agent a question to start a discussion grounded in those
              selections.
            </p>
            <Button
              className="mt-1 gap-1.5"
              onClick={onBrowseDiff}
              size="sm"
              type="button"
              variant="secondary"
            >
              <GitCompareArrows className="size-3.5" />
              Go to diff
            </Button>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {annotations.map((annotation) => (
              <li key={annotation.thread.id}>
                <ReviewThreadAnnotation annotation={annotation} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
