import type { FormEvent } from 'react'
import { MessagesSquare, Send, X } from 'lucide-react'
import type { ReviewThreadAnchorRef } from '@/entities/review-thread'
import { Button } from '@/shared/ui/button'

/** An open discussion the pinned selections can be attached to. */
export interface DiscussionTarget {
  id: string
  label: string
}

export interface PinnedDiscussionComposerProps {
  pins: ReviewThreadAnchorRef[]
  body: string
  error: string | null
  isSubmitting: boolean
  // Open discussions the pins can be attached to instead of starting a new one.
  discussions: DiscussionTarget[]
  // null = start a new discussion; otherwise the discussion id to attach to.
  targetThreadId: string | null
  onTargetChange: (threadId: string | null) => void
  onBodyChange: (body: string) => void
  onClear: () => void
  onRemovePin: (index: number) => void
  onSubmit: () => void
}

function anchorLabel(anchor: ReviewThreadAnchorRef): string {
  const name = anchor.filePath.split('/').pop() || anchor.filePath
  return `${name}:${anchor.lineStart}-${anchor.lineEnd}`
}

/**
 * Composer for the pinned selections collected across the diff. By default they
 * start a new multi-anchor discussion (the first pin is the primary anchor, the
 * rest ride along) with one question. When an existing discussion is chosen as
 * the target, the pins are instead attached to it to ground the next question.
 */
export function PinnedDiscussionComposer({
  body,
  discussions,
  error,
  isSubmitting,
  onBodyChange,
  onClear,
  onRemovePin,
  onSubmit,
  onTargetChange,
  pins,
  targetThreadId,
}: PinnedDiscussionComposerProps) {
  const isAttaching = targetThreadId !== null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form
      aria-label="Discussion across pinned selections"
      className="grid gap-2 border-b border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-xs"
      onSubmit={submit}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 font-medium">
          <MessagesSquare
            aria-hidden="true"
            className="size-3.5 text-sky-500"
          />
          <span>
            {pins.length} pinned selection
            {pins.length === 1 ? '' : 's'}
          </span>
        </div>
        <Button
          aria-label="Discard pinned selections"
          onClick={onClear}
          size="sm"
          type="button"
          variant="ghost"
        >
          Clear
        </Button>
      </div>

      {discussions.length > 0 ? (
        <label className="flex items-center gap-2">
          <span className="text-[var(--muted)]">Add to</span>
          <select
            aria-label="Attach pinned selections to"
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs text-[var(--foreground)] outline-none"
            onChange={(event) => onTargetChange(event.target.value || null)}
            value={targetThreadId ?? ''}
          >
            <option value="">New discussion</option>
            {discussions.map((discussion) => (
              <option key={discussion.id} value={discussion.id}>
                {discussion.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <ul className="flex flex-wrap gap-1.5">
        {pins.map((pin, index) => (
          <li
            className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[11px]"
            key={`${pin.filePath}:${pin.side}:${pin.lineStart}-${pin.lineEnd}:${index}`}
          >
            <span className="truncate">{anchorLabel(pin)}</span>
            <Button
              aria-label={`Remove ${anchorLabel(pin)}`}
              className="size-4 p-0 text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => onRemovePin(index)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-3" />
            </Button>
          </li>
        ))}
      </ul>

      {isAttaching ? (
        <p className="text-[var(--muted)]">
          These selections will be attached to the discussion. Ask your question
          there once they are added.
        </p>
      ) : (
        <textarea
          aria-label="Discussion question"
          className="min-h-16 resize-y rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          onChange={(event) => onBodyChange(event.target.value)}
          placeholder="Ask one question about these selections (e.g. how do these interact?)"
          value={body}
        />
      )}

      {error ? <p className="text-[var(--danger)]">{error}</p> : null}

      <div className="flex justify-end">
        <Button
          disabled={isSubmitting || (!isAttaching && !body.trim())}
          size="sm"
          type="submit"
          variant="primary"
        >
          <Send aria-hidden="true" className="size-3.5" />
          {isAttaching
            ? isSubmitting
              ? 'Attaching'
              : `Attach ${pins.length} selection${pins.length === 1 ? '' : 's'}`
            : isSubmitting
              ? 'Asking'
              : 'Ask agent'}
        </Button>
      </div>
    </form>
  )
}
