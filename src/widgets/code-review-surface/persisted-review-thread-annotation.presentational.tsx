import type { FormEvent } from 'react'
import {
  Bot,
  Check,
  CheckCircle2,
  GitCommitHorizontal,
  MessageCircle,
  MessagesSquare,
  RotateCcw,
  Send,
  Wrench,
  X,
} from 'lucide-react'
import { AnimatedStatus } from '@/shared/ui/animated-status'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { StreamingMarkdown } from '@/shared/ui/streaming-markdown'
import { cn } from '@/shared/lib/cn.pure'
import { describeReviewAgentActivity } from './review-agent-activity.pure'
import { ThreadExcerpt } from './thread-excerpt.presentational'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'
import {
  describeThreadAnchor,
  formatAnchorLineRange,
} from './review-thread-annotation-anchor.pure'

export function PersistedReviewThreadAnnotation({
  annotation,
}: {
  annotation: Extract<ReviewThreadAnnotationData, { kind: 'thread' }>
}) {
  const { thread } = annotation
  const isDiscussion = annotation.variant === 'discussion'
  // A discussion references its primary anchor plus every pinned selection.
  const referenceAnchors = isDiscussion
    ? [
        {
          anchorCommitSha: thread.anchorCommitSha,
          excerpt: thread.excerpt,
          filePath: thread.filePath,
          lineEnd: thread.lineEnd,
          lineStart: thread.lineStart,
          side: thread.side,
        },
        ...(thread.extraAnchors ?? []),
      ]
    : []

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    annotation.onReplySubmit()
  }

  return (
    <article
      aria-label={
        isDiscussion
          ? 'Discussion'
          : `Review thread on ${describeThreadAnchor(thread)}`
      }
      className="my-2 mr-3 min-w-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] text-xs shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {isDiscussion ? (
            <MessagesSquare
              aria-hidden="true"
              className="size-3.5 text-sky-500"
            />
          ) : (
            <MessageCircle
              aria-hidden="true"
              className="size-3.5 text-sky-500"
            />
          )}
          <p className="truncate font-medium">
            {isDiscussion
              ? 'Discussion'
              : `Thread on ${describeThreadAnchor(thread)}`}
          </p>
          {thread.status === 'resolved' ? (
            <Badge className="h-5 px-1.5" tone="success">
              Resolved
            </Badge>
          ) : null}
          {thread.status === 'outdated' ? (
            <Badge className="h-5 px-1.5" tone="warning">
              Outdated
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
      {isDiscussion ? (
        <div className="grid gap-1 border-b border-[var(--border)] px-3 py-2">
          <p className="text-[11px] font-medium text-[var(--muted)]">
            References {referenceAnchors.length} selection
            {referenceAnchors.length === 1 ? '' : 's'}:
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {referenceAnchors.map((anchor, index) => (
              <li
                key={`${anchor.filePath}:${anchor.side}:${anchor.lineStart}-${anchor.lineEnd}:${index}`}
              >
                <Button
                  className="h-auto gap-1 px-1.5 py-0.5 font-mono text-[11px]"
                  onClick={() => annotation.onJumpToAnchor?.(anchor)}
                  size="sm"
                  title={`${anchor.filePath}:${formatAnchorLineRange(anchor)}`}
                  type="button"
                  variant="secondary"
                >
                  {anchor.filePath.split('/').pop() || anchor.filePath}:
                  {formatAnchorLineRange(anchor)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <ThreadExcerpt excerpt={thread.excerpt} />
          {thread.extraAnchors && thread.extraAnchors.length > 0 ? (
            <div className="border-b border-[var(--border)] px-3 py-2">
              <p className="mb-1 text-[11px] font-medium text-[var(--muted)]">
                Also referencing {thread.extraAnchors.length} selection
                {thread.extraAnchors.length === 1 ? '' : 's'}:
              </p>
              <ul className="grid gap-1">
                {thread.extraAnchors.map((anchor, index) => (
                  <li
                    className="truncate font-mono text-[11px] text-[var(--muted)]"
                    key={`${anchor.filePath}:${anchor.side}:${anchor.lineStart}-${anchor.lineEnd}:${index}`}
                  >
                    {anchor.filePath.split('/').pop() || anchor.filePath}:
                    {formatAnchorLineRange(anchor)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
      <ol className="divide-y divide-[var(--border)]">
        {thread.comments.map((comment) => {
          if (comment.commentKind === 'system') {
            return (
              <li
                className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-[var(--muted)]"
                key={comment.id}
              >
                <GitCommitHorizontal aria-hidden="true" className="size-3.5" />
                <span className="whitespace-pre-wrap">{comment.body}</span>
              </li>
            )
          }

          const isFixProposal = comment.commentKind === 'fix-proposal'
          const isActing = annotation.fixActionCommentId === comment.id

          return (
            <li
              className={cn(
                'grid min-w-0 gap-1 px-3 py-2',
                comment.pending ? 'opacity-60' : undefined,
              )}
              key={comment.id}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
                {comment.authorType === 'agent' ? (
                  <Bot aria-hidden="true" className="size-3.5" />
                ) : (
                  <MessageCircle aria-hidden="true" className="size-3.5" />
                )}
                <span>
                  {comment.authorType === 'agent'
                    ? 'Agent'
                    : (comment.authorName ?? 'Reviewer')}
                </span>
                {isFixProposal ? (
                  <Badge className="h-5 gap-1 px-1.5" tone="default">
                    <Wrench aria-hidden="true" className="size-3" />
                    Fix
                  </Badge>
                ) : null}
                {comment.agentState ? (
                  <span className="flex items-center gap-1 font-normal">
                    ·
                    <AnimatedStatus
                      status={
                        (comment.agentState === 'pending' ||
                          comment.agentState === 'streaming') &&
                        annotation.agentActivity
                          ? describeReviewAgentActivity(
                              annotation.agentActivity,
                            )
                          : comment.agentState
                      }
                    />
                  </span>
                ) : null}
              </div>
              {comment.body ? (
                <StreamingMarkdown
                  className="leading-5 text-[var(--foreground)]"
                  content={comment.body}
                  isStreaming={comment.agentState === 'streaming'}
                />
              ) : null}
              {isFixProposal && comment.fixState === 'proposed' ? (
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    disabled={isActing}
                    onClick={() => annotation.onDiscardFix(comment.id)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                    {annotation.isDiscardingFix && isActing
                      ? 'Discarding'
                      : 'Discard'}
                  </Button>
                  <Button
                    disabled={isActing}
                    onClick={() => annotation.onApproveFix(comment.id)}
                    size="sm"
                    type="button"
                    variant="primary"
                  >
                    <Check aria-hidden="true" className="size-3.5" />
                    {annotation.isPushingFix && isActing
                      ? 'Pushing'
                      : 'Approve and push'}
                  </Button>
                </div>
              ) : null}
              {isFixProposal &&
              comment.fixState === 'pushed' &&
              comment.commitSha ? (
                <Badge className="w-fit gap-1" tone="success">
                  <GitCommitHorizontal aria-hidden="true" className="size-3" />
                  Pushed {comment.commitSha.slice(0, 7)}
                </Badge>
              ) : null}
              {isFixProposal && comment.fixState === 'discarded' ? (
                <span className="text-[11px] text-[var(--muted)]">
                  Discarded
                </span>
              ) : null}
            </li>
          )
        })}
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
            disabled={annotation.isAskingFix || annotation.isAskingAgent}
            onClick={annotation.onAskFix}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Wrench aria-hidden="true" className="size-3.5" />
            {annotation.isAskingFix ? 'Asking fix' : 'Ask to fix'}
          </Button>
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
