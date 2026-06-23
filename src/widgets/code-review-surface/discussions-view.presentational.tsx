import {
  GitCompareArrows,
  MessageSquarePlus,
  MessagesSquare,
} from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  DiscussionComposer,
  type DiscussionComposerProps,
} from './discussion-composer.presentational'
import { ReviewThreadAnnotation } from './review-thread-annotation.presentational'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'

/**
 * The Discussions surface: whole-PR conversations with the agent, decoupled
 * from inline diff threads. A discussion can be started right here with no
 * anchors (the agent has full pull-request context) and grounded later by
 * pinning selections in the diff. Each card lists the selections it references
 * as chips that jump back into the diff.
 */
export function DiscussionsView({
  annotations,
  composer,
  onBrowseDiff,
}: {
  annotations: Extract<ReviewThreadAnnotationData, { kind: 'thread' }>[]
  composer: DiscussionComposerProps
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
              Conversations about the whole pull request. Start one here, or pin
              selections in the diff to ground it in specific code.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {composer.open ? null : (
              <Button
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={composer.onOpen}
                size="sm"
                type="button"
                variant="primary"
              >
                <MessageSquarePlus className="size-3.5" />
                New discussion
              </Button>
            )}
            <Button
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={onBrowseDiff}
              size="sm"
              type="button"
              variant="outline"
            >
              <GitCompareArrows className="size-3.5" />
              Browse diff
            </Button>
          </div>
        </div>

        {composer.open ? <DiscussionComposer {...composer} /> : null}

        {annotations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-10 text-center">
            <MessagesSquare
              aria-hidden="true"
              className="size-6 text-muted-foreground"
            />
            <p className="text-sm font-medium">No discussions yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Ask the agent anything about this pull request to start a
              discussion — no selection needed. Pin ranges in the diff later to
              focus the conversation on specific code.
            </p>
            {composer.open ? null : (
              <Button
                className="mt-1 gap-1.5"
                onClick={composer.onOpen}
                size="sm"
                type="button"
                variant="secondary"
              >
                <MessageSquarePlus className="size-3.5" />
                New discussion
              </Button>
            )}
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
