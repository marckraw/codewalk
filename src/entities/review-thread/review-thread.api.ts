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
 * Asks the per-PR review agent to answer the latest reviewer question in the
 * thread. Resolves with the updated thread once the agent turn completes —
 * the agent comment goes through pending server-side (streaming is P8).
 */
export async function requestReviewThreadAgentReply(
  threadId: string,
): Promise<ReviewThread> {
  const response = await fetch(
    `/api/review-threads/${encodeURIComponent(threadId)}/agent-reply`,
    { method: 'POST' },
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
