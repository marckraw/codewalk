import type { FormEvent } from 'react'
import { Bot, CheckCircle2, MessageCircle, RotateCcw, Send } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ThreadExcerpt } from './thread-excerpt.presentational'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'
import { describeThreadAnchor } from './review-thread-annotation-anchor.pure'

export function PersistedReviewThreadAnnotation({
  annotation,
}: {
  annotation: Extract<ReviewThreadAnnotationData, { kind: 'thread' }>
}) {
  const { thread } = annotation

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    annotation.onReplySubmit()
  }

  return (
    <article
      aria-label={`Review thread on ${describeThreadAnchor(thread)}`}
      className="my-2 mr-3 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] text-xs shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle aria-hidden="true" className="size-3.5 text-sky-500" />
          <p className="truncate font-medium">
            Thread on {describeThreadAnchor(thread)}
          </p>
          {thread.status === 'resolved' ? (
            <Badge className="h-5 px-1.5" tone="success">
              Resolved
            </Badge>
          ) : null}
        </div>
        <Button
          disabled={annotation.isUpdatingStatus}
          onClick={() =>
            annotation.onStatusChange(
              thread.status === 'resolved' ? 'open' : 'resolved',
            )
          }
          size="sm"
          type="button"
          variant="ghost"
        >
          {thread.status === 'resolved' ? (
            <RotateCcw aria-hidden="true" className="size-3.5" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
          )}
          {thread.status === 'resolved' ? 'Reopen' : 'Resolve'}
        </Button>
      </div>
      <ThreadExcerpt excerpt={thread.excerpt} />
      <ol className="divide-y divide-[var(--border)]">
        {thread.comments.map((comment) => (
          <li className="grid gap-1 px-3 py-2" key={comment.id}>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
              {comment.authorType === 'agent' ? (
                <Bot aria-hidden="true" className="size-3.5" />
              ) : (
                <MessageCircle aria-hidden="true" className="size-3.5" />
              )}
              <span>
                {comment.authorType === 'agent' ? 'Agent' : 'Reviewer'}
              </span>
              {comment.agentState ? (
                <span className="font-normal">· {comment.agentState}</span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap leading-5 text-[var(--foreground)]">
              {comment.body}
            </p>
          </li>
        ))}
      </ol>
      <form
        className="grid gap-2 border-t border-[var(--border)] p-3"
        onSubmit={submit}
      >
        <textarea
          aria-label="Reply to review thread"
          className="min-h-16 resize-y rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
          onChange={(event) => annotation.onReplyBodyChange(event.target.value)}
          placeholder="Reply in this thread"
          value={annotation.replyBody}
        />
        {annotation.error ? (
          <p className="text-[var(--danger)]">{annotation.error}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            disabled={
              annotation.isAskingAgent ||
              annotation.isReplying ||
              !annotation.replyBody.trim()
            }
            onClick={annotation.onAskAgent}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Bot aria-hidden="true" className="size-3.5" />
            {annotation.isAskingAgent ? 'Asking agent' : 'Ask agent'}
          </Button>
          <Button
            disabled={
              annotation.isAskingAgent ||
              annotation.isReplying ||
              !annotation.replyBody.trim()
            }
            size="sm"
            type="submit"
            variant="primary"
          >
            <Send aria-hidden="true" className="size-3.5" />
            {annotation.isReplying ? 'Replying' : 'Reply'}
          </Button>
        </div>
      </form>
    </article>
  )
}
