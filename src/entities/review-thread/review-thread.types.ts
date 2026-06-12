export type ReviewThreadDiffSide = 'old' | 'new'
export type ReviewThreadStatus = 'open' | 'resolved' | 'outdated'
export type ReviewThreadCommentAuthorType = 'user' | 'agent'
export type ReviewThreadAgentState =
  | 'pending'
  | 'streaming'
  | 'complete'
  | 'error'

export type ReviewThreadComment = {
  id: string
  threadId: string
  authorType: ReviewThreadCommentAuthorType
  authorUserId: string | null
  body: string
  agentState: ReviewThreadAgentState | null
  createdAt: string
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
  body: string
}
