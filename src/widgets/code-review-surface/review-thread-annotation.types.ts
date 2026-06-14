import type {
  ReviewThread,
  ReviewThreadAnchorRef,
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
      onPinSelection: () => void
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
      // Discussion cards (variant 'discussion') jump to a referenced selection
      // in the diff when a chip is clicked.
      onJumpToAnchor?: (anchor: ReviewThreadAnchorRef) => void
      replyBody: string
      thread: ReviewThread
      // 'inline' (default) renders as a diff annotation anchored to a line;
      // 'discussion' renders in the Discussions surface with reference chips.
      variant?: 'inline' | 'discussion'
    }
