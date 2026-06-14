import type {
  CreateReviewThreadInput,
  ListReviewThreadsParams,
  ReviewThread,
  ReviewThreadComment,
  ReviewThreadStatus,
} from './review-thread.types'

export async function listReviewThreads(
  params: ListReviewThreadsParams,
): Promise<ReviewThread[]> {
  const url = new URL('/api/review-threads', window.location.origin)
  url.searchParams.set('owner', params.owner)
  url.searchParams.set('repo', params.repo)
  url.searchParams.set('number', String(params.number))

  const response = await fetch(url)
  const body = (await readReviewThreadApiResponse(response)) as {
    error?: string
    threads?: ReviewThread[]
  }

  if (!response.ok || !body.threads) {
    throw new ReviewThreadApiError(
      body.error ??
        `Loading review threads failed with HTTP ${response.status}.`,
      response.status,
    )
  }

  return body.threads
}

export async function createReviewThread(
  input: CreateReviewThreadInput,
): Promise<ReviewThread> {
  const response = await fetch('/api/review-threads', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const body = (await readReviewThreadApiResponse(response)) as {
    error?: string
    thread?: ReviewThread
  }

  if (!response.ok || !body.thread) {
    throw new ReviewThreadApiError(
      body.error ??
        `Creating the review thread failed with HTTP ${response.status}.`,
      response.status,
    )
  }

  return body.thread
}

export async function addReviewThreadComment(input: {
  body: string
  threadId: string
}): Promise<ReviewThreadComment> {
  const response = await fetch(
    `/api/review-threads/${encodeURIComponent(input.threadId)}/comments`,
    {
      body: JSON.stringify({ body: input.body }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )
  const body = (await readReviewThreadApiResponse(response)) as {
    comment?: ReviewThreadComment
    error?: string
  }

  if (!response.ok || !body.comment) {
    throw new ReviewThreadApiError(
      body.error ??
        `Adding the review thread reply failed with HTTP ${response.status}.`,
      response.status,
    )
  }

  return body.comment
}

export async function updateReviewThreadStatus(input: {
  status: Extract<ReviewThreadStatus, 'open' | 'resolved'>
  threadId: string
}): Promise<ReviewThread> {
  const response = await fetch(
    `/api/review-threads/${encodeURIComponent(input.threadId)}`,
    {
      body: JSON.stringify({ status: input.status }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  )
  const body = (await readReviewThreadApiResponse(response)) as {
    error?: string
    thread?: ReviewThread
  }

  if (!response.ok || !body.thread) {
    throw new ReviewThreadApiError(
      body.error ??
        `Updating the review thread failed with HTTP ${response.status}.`,
      response.status,
    )
  }

  return body.thread
}

/**
 * Starts an agent reply for the latest reviewer question in the thread. The
 * response returns as soon as the question is queued — completion is observed
 * by polling pollReviewThreadAgentReply until the agent comment leaves the
 * pending state.
 */
export async function requestReviewThreadAgentReply(
  threadId: string,
): Promise<ReviewThread> {
  return agentReplyRequest(threadId, { method: 'POST' })
}

/** One polling step of a running agent turn; returns the updated thread. */
export async function pollReviewThreadAgentReply(
  threadId: string,
): Promise<ReviewThread> {
  return agentReplyRequest(threadId, { method: 'GET' })
}

async function agentReplyRequest(
  threadId: string,
  init: RequestInit,
): Promise<ReviewThread> {
  const response = await fetch(
    `/api/review-threads/${encodeURIComponent(threadId)}/agent-reply`,
    init,
  )
  const body = (await readReviewThreadApiResponse(response)) as {
    error?: string
    thread?: ReviewThread
  }

  if (!response.ok || !body.thread) {
    throw new ReviewThreadApiError(
      body.error ??
        `Asking the review agent failed with HTTP ${response.status}.`,
      response.status,
    )
  }

  return body.thread
}

/**
 * Asks the agent to implement the change discussed in the thread. Returns once
 * the fix turn is queued — completion is observed by polling
 * pollReviewThreadAgentReply, exactly like a question.
 */
export async function requestReviewThreadAgentFix(input: {
  instruction?: string
  threadId: string
}): Promise<ReviewThread> {
  const response = await fetch(
    `/api/review-threads/${encodeURIComponent(input.threadId)}/fix`,
    {
      body: JSON.stringify(
        input.instruction ? { instruction: input.instruction } : {},
      ),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )

  return readReviewThreadResult(
    response,
    `Asking the review agent to fix failed with HTTP ${response.status}.`,
  )
}

/** Approves a proposed fix and pushes its commit to the PR head branch. */
export async function approveReviewThreadFix(input: {
  commentId: string
  threadId: string
}): Promise<ReviewThread> {
  const response = await fetch(
    `/api/review-threads/${encodeURIComponent(
      input.threadId,
    )}/comments/${encodeURIComponent(input.commentId)}/approve-push`,
    { method: 'POST' },
  )

  return readReviewThreadResult(
    response,
    `Pushing the fix failed with HTTP ${response.status}.`,
  )
}

/** Discards a proposed fix and asks the agent to revert its workspace commit. */
export async function discardReviewThreadFix(input: {
  commentId: string
  threadId: string
}): Promise<ReviewThread> {
  const response = await fetch(
    `/api/review-threads/${encodeURIComponent(
      input.threadId,
    )}/comments/${encodeURIComponent(input.commentId)}/discard`,
    { method: 'POST' },
  )

  return readReviewThreadResult(
    response,
    `Discarding the fix failed with HTTP ${response.status}.`,
  )
}

async function readReviewThreadResult(
  response: Response,
  fallbackMessage: string,
): Promise<ReviewThread> {
  const body = (await readReviewThreadApiResponse(response)) as {
    error?: string
    thread?: ReviewThread
  }

  if (!response.ok || !body.thread) {
    throw new ReviewThreadApiError(
      body.error ?? fallbackMessage,
      response.status,
    )
  }

  return body.thread
}

export type ReviewAgentSessionStatus = {
  activity: string | null
  state: 'none' | 'lost' | 'idle' | 'running' | 'completed' | 'failed'
}

/**
 * Reads what the per-PR agent session is currently doing — shown next to a
 * pending agent comment. Read-only; never starts a session.
 */
export async function fetchReviewAgentSessionStatus(
  params: ListReviewThreadsParams,
): Promise<ReviewAgentSessionStatus> {
  const url = new URL(
    '/api/review-agent-sessions/status',
    window.location.origin,
  )
  url.searchParams.set('owner', params.owner)
  url.searchParams.set('repo', params.repo)
  url.searchParams.set('number', String(params.number))

  const response = await fetch(url)
  const body = (await readReviewThreadApiResponse(response)) as {
    activity?: string | null
    error?: string
    state?: ReviewAgentSessionStatus['state']
  }

  if (!response.ok || !body.state) {
    throw new ReviewThreadApiError(
      body.error ??
        `Reading the review agent status failed with HTTP ${response.status}.`,
      response.status,
    )
  }

  return { activity: body.activity ?? null, state: body.state }
}

export class ReviewThreadApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ReviewThreadApiError'
  }
}

async function readReviewThreadApiResponse(response: Response) {
  const contentType = response.headers.get('Content-Type') ?? ''

  if (!contentType.toLowerCase().includes('application/json')) {
    return {}
  }

  return (await response.json()) as unknown
}
