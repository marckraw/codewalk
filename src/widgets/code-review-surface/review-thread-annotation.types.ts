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
      error: string | null
      isAskingAgent: boolean
      isReplying: boolean
      isUpdatingStatus: boolean
      kind: 'thread'
      onAskAgent: () => void
      onReplyBodyChange: (body: string) => void
      onReplySubmit: () => void
      onStatusChange: (status: 'open' | 'resolved') => void
      replyBody: string
      thread: ReviewThread
    }
