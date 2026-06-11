import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

vi.mock('server-only', () => ({}))

vi.mock('@/entities/database', () => ({
  getCodeReviewGuideGenerationByDaemonJobId: vi.fn(),
}))

vi.mock('@/features/code-review-guide-generation', () => ({
  finalizeCodeReviewGuideGenerationFromJob: vi.fn(),
}))

import { getCodeReviewGuideGenerationByDaemonJobId } from '@/entities/database'
import { finalizeCodeReviewGuideGenerationFromJob } from '@/features/code-review-guide-generation'

const SECRET = 'callback-secret'

const readyPayload = {
  error: null,
  event: 'code-review-guide-job.finished',
  finishedAt: '2026-06-11T12:00:00.000Z',
  jobId: 'job-1',
  result: null,
  status: 'failed',
}

function sign(rawBody: string, secret = SECRET) {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`
}

function callbackRequest(
  payload: unknown,
  options: { signature?: string | null } = {},
) {
  const rawBody =
    typeof payload === 'string' ? payload : JSON.stringify(payload)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  const signature =
    options.signature === undefined ? sign(rawBody) : options.signature

  if (signature !== null) {
    headers['x-webhook-signature'] = signature
  }

  return new Request('http://localhost/api/code-review-guides/callback', {
    body: rawBody,
    headers,
    method: 'POST',
  })
}

describe('POST /api/code-review-guides/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCodeReviewGuideGenerationByDaemonJobId).mockResolvedValue({
      daemonCallbackSecret: SECRET,
      daemonJobId: 'job-1',
      id: 'generation-id',
      snapshotId: 'snapshot-id',
      status: 'running',
    } as never)
    vi.mocked(finalizeCodeReviewGuideGenerationFromJob).mockResolvedValue({
      action: 'finalized',
      status: 'failed',
    })
  })

  it('verifies the signature and finalizes the generation', async () => {
    const response = await POST(callbackRequest(readyPayload))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      result: { action: 'finalized', status: 'failed' },
    })
    expect(getCodeReviewGuideGenerationByDaemonJobId).toHaveBeenCalledWith(
      'job-1',
    )
    expect(finalizeCodeReviewGuideGenerationFromJob).toHaveBeenCalledWith({
      job: {
        error: null,
        jobId: 'job-1',
        result: null,
        status: 'failed',
      },
      snapshotId: 'snapshot-id',
    })
  })

  it('rejects payloads without a job id', async () => {
    const response = await POST(callbackRequest({ status: 'ready' }))

    expect(response.status).toBe(400)
    expect(getCodeReviewGuideGenerationByDaemonJobId).not.toHaveBeenCalled()
  })

  it('returns 404 when no generation is waiting for the job', async () => {
    vi.mocked(getCodeReviewGuideGenerationByDaemonJobId).mockResolvedValue(null)

    const response = await POST(callbackRequest(readyPayload))

    expect(response.status).toBe(404)
    expect(finalizeCodeReviewGuideGenerationFromJob).not.toHaveBeenCalled()
  })

  it('rejects invalid and missing signatures', async () => {
    const wrongSecret = await POST(
      callbackRequest(readyPayload, {
        signature: sign(JSON.stringify(readyPayload), 'other-secret'),
      }),
    )
    expect(wrongSecret.status).toBe(401)

    const missing = await POST(
      callbackRequest(readyPayload, { signature: null }),
    )
    expect(missing.status).toBe(401)
    expect(finalizeCodeReviewGuideGenerationFromJob).not.toHaveBeenCalled()
  })

  it('acknowledges replays for already-finalized generations without re-finalizing', async () => {
    vi.mocked(getCodeReviewGuideGenerationByDaemonJobId).mockResolvedValue({
      daemonCallbackSecret: SECRET,
      daemonJobId: 'job-1',
      id: 'generation-id',
      snapshotId: 'snapshot-id',
      status: 'failed',
    } as never)

    const response = await POST(callbackRequest(readyPayload))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: 'already-finalized',
    })
    expect(finalizeCodeReviewGuideGenerationFromJob).not.toHaveBeenCalled()
  })

  it('rejects signed payloads that are not valid guide jobs', async () => {
    const response = await POST(
      callbackRequest({ jobId: 'job-1', status: 'odd' }),
    )

    expect(response.status).toBe(400)
    expect(finalizeCodeReviewGuideGenerationFromJob).not.toHaveBeenCalled()
  })
})
