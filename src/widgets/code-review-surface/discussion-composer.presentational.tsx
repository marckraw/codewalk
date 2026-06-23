import type { FormEvent } from 'react'
import { MessagesSquare, Send, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'

export interface DiscussionComposerProps {
  body: string
  error: string | null
  isSubmitting: boolean
  open: boolean
  onBodyChange: (body: string) => void
  onCancel: () => void
  onOpen: () => void
  onSubmit: () => void
}

/** Anchorless composer for starting a whole-PR discussion. */
export function DiscussionComposer({
  body,
  error,
  isSubmitting,
  onBodyChange,
  onCancel,
  onSubmit,
}: DiscussionComposerProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form
      aria-label="Start a discussion"
      className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-xs"
      onSubmit={submit}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 font-medium">
          <MessagesSquare
            aria-hidden="true"
            className="size-3.5 text-sky-500"
          />
          <span>New discussion · whole pull request</span>
        </div>
        <Button
          aria-label="Cancel discussion"
          onClick={onCancel}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </div>

      <textarea
        aria-label="Discussion question"
        autoFocus
        className="min-h-16 resize-y rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder="Ask the agent about this pull request (e.g. what's the riskiest change here?)"
        value={body}
      />

      {error ? <p className="text-[var(--danger)]">{error}</p> : null}

      <div className="flex justify-end">
        <Button
          disabled={isSubmitting || !body.trim()}
          size="sm"
          type="submit"
          variant="primary"
        >
          <Send aria-hidden="true" className="size-3.5" />
          {isSubmitting ? 'Asking' : 'Ask agent'}
        </Button>
      </div>
    </form>
  )
}
