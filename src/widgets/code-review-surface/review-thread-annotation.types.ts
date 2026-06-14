import type {
  ReviewThread,
  ReviewThreadSelectionAnchor,
} from '@/entities/review-thread'

export type ReviewThreadAnnotationData =
  | {
      anchor: ReviewThreadSelectionAnchor
      body: string
      error: string | null
      isSubmitting: boolean
      kind: 'draft'
      onBodyChange: (body: string) => void
      onCancel: () => void
      onSubmit: () => void
    }
  | {
      agentActivity: string | null
      error: string | null
      // The fix-proposal comment id currently being pushed or discarded, used
      // to disable its actions while the request is in flight.
      fixActionCommentId: string | null
      isAskingAgent: boolean
      isAskingFix: boolean
      isDiscardingFix: boolean
      isPushingFix: boolean
      isReplying: boolean
      isUpdatingStatus: boolean
      kind: 'thread'
      onApproveFix: (commentId: string) => void
      onAskAgent: () => void
      onAskFix: () => void
      onDiscardFix: (commentId: string) => void
      onReplyBodyChange: (body: string) => void
      onReplySubmit: () => void
      onStatusChange: (status: 'open' | 'resolved') => void
      replyBody: string
      thread: ReviewThread
    }
