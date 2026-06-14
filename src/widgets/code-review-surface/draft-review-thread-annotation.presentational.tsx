import type { FormEvent } from 'react'
import { MessageCircle, Pin, Send, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { ThreadExcerpt } from './thread-excerpt.presentational'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'
import { describeThreadAnchor } from './review-thread-annotation-anchor.pure'

export function DraftReviewThreadAnnotation({
  annotation,
}: {
  annotation: Extract<ReviewThreadAnnotationData, { kind: 'draft' }>
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    annotation.onSubmit()
  }

  return (
    <form
      aria-label="New review thread"
      className="my-2 mr-3 rounded-md border border-[var(--border)] bg-[var(--panel)] text-xs shadow-sm"
      onSubmit={submit}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle aria-hidden="true" className="size-3.5 text-sky-500" />
          <p className="truncate font-medium">
            New thread on {describeThreadAnchor(annotation.anchor)}
          </p>
        </div>
        <Button
          aria-label="Cancel review thread"
          onClick={annotation.onCancel}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
      <ThreadExcerpt excerpt={annotation.anchor.excerpt} />
      <div className="grid gap-2 p-3">
        <textarea
          aria-label="Review thread comment"
          className="min-h-20 resize-y rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          onChange={(event) => annotation.onBodyChange(event.target.value)}
          placeholder="Ask about these lines"
          value={annotation.body}
        />
        {annotation.error ? (
          <p className="text-[var(--danger)]">{annotation.error}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            onClick={annotation.onCancel}
            size="sm"
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={annotation.onPinSelection}
            size="sm"
            title="Pin this selection to ask about several together"
            type="button"
            variant="ghost"
          >
            <Pin aria-hidden="true" className="size-3.5" />
            Pin selection
          </Button>
          <Button
            disabled={annotation.isSubmitting || !annotation.body.trim()}
            size="sm"
            type="submit"
            variant="primary"
          >
            <Send aria-hidden="true" className="size-3.5" />
            {annotation.isSubmitting ? 'Posting' : 'Start thread'}
          </Button>
        </div>
      </div>
    </form>
  )
}
