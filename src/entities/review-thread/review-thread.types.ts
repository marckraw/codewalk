export type ReviewThreadDiffSide = 'old' | 'new'
export type ReviewThreadStatus = 'open' | 'resolved' | 'outdated'
export type ReviewThreadCommentAuthorType = 'user' | 'agent'
export type ReviewThreadAgentState =
  | 'pending'
  | 'streaming'
  | 'complete'
  | 'error'
export type ReviewThreadCommentKind = 'message' | 'fix-proposal' | 'system'
export type ReviewThreadFixState = 'proposed' | 'pushed' | 'discarded'
export type ReviewThreadKind = 'inline' | 'discussion'

/** An additional selection a multi-anchor discussion thread references. */
export type ReviewThreadAnchorRef = {
  anchorCommitSha: string
  excerpt: string
  filePath: string
  lineEnd: number
  lineStart: number
  side: ReviewThreadDiffSide
}

export type ReviewThreadComment = {
  id: string
  threadId: string
  authorType: ReviewThreadCommentAuthorType
  authorUserId: string | null
  authorName?: string | null
  body: string
  agentState: ReviewThreadAgentState | null
  commentKind: ReviewThreadCommentKind
  fixState: ReviewThreadFixState | null
  commitSha: string | null
  createdAt: string
  /** Set on an optimistic comment shown before the server confirms it; the UI
   *  dims it as "sending". Replaced by the persisted comment on success. */
  pending?: boolean
}

export type ReviewThread = {
  id: string
  owner: string
  repo: string
  pullRequestNumber: number
  anchorSnapshotId: string | null
  anchorCommitSha: string
  filePath: string
  side: ReviewThreadDiffSide
  lineStart: number
  lineEnd: number
  excerpt: string
  extraAnchors?: ReviewThreadAnchorRef[] | null
  kind?: ReviewThreadKind
  status: ReviewThreadStatus
  createdByUserId: string
  createdAt: string
  updatedAt: string
  comments: ReviewThreadComment[]
}

export type ListReviewThreadsParams = {
  owner: string
  repo: string
  number: number
}

export type CreateReviewThreadInput = ListReviewThreadsParams & {
  anchorSnapshotId: string | null
  anchorCommitSha: string
  filePath: string
  side: ReviewThreadDiffSide
  lineStart: number
  lineEnd: number
  excerpt: string
  extraAnchors?: ReviewThreadAnchorRef[]
  kind?: ReviewThreadKind
  body: string
}
