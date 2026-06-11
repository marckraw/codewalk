import { NextResponse } from 'next/server'
import {
  parseAgentsDaemonGuideJob,
  verifyAgentsDaemonCallbackSignature,
} from '@/entities/agents-daemon'
import { getCodeReviewGuideGenerationByDaemonJobId } from '@/entities/database'
import { finalizeCodeReviewGuideGenerationFromJob } from '@/features/code-review-guide-generation'
import {
  logCodewalkEvent,
  logCodewalkWarning,
} from '@/shared/lib/observability'

export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * Completion callback from agents-daemon: a guide job reached ready/failed.
 * Authenticated per job — the daemon signs the raw body with the secret this
 * deployment generated at submit time, so only the daemon that received the
 * submission can finalize it. Reconcile-on-poll remains the safety net when
 * deliveries are lost, and both paths share the same idempotent finalize.
 */
export async function POST(request: Request) {
  const rawBody = await request.text()

  let jobId: string

  try {
    const parsed: unknown = JSON.parse(rawBody)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('jobId' in parsed) ||
      typeof parsed.jobId !== 'string' ||
      !parsed.jobId.trim()
    ) {
      throw new Error('Callback payload requires a jobId.')
    }

    jobId = parsed.jobId
  } catch {
    return NextResponse.json(
      { error: 'Callback payload must be JSON with a jobId.' },
      { status: 400 },
    )
  }

  const generation = await getCodeReviewGuideGenerationByDaemonJobId(jobId)

  if (!generation || !generation.daemonCallbackSecret) {
    logCodewalkWarning('codewalk.guide_callback.unknown_job', { jobId })
    return NextResponse.json(
      { error: 'No generation is waiting for this job.' },
      { status: 404 },
    )
  }

  const signatureIsValid = verifyAgentsDaemonCallbackSignature({
    rawBody,
    secret: generation.daemonCallbackSecret,
    signatureHeader: request.headers.get('x-webhook-signature'),
  })

  if (!signatureIsValid) {
    logCodewalkWarning('codewalk.guide_callback.invalid_signature', { jobId })
    return NextResponse.json(
      { error: 'Invalid callback signature.' },
      { status: 401 },
    )
  }

  if (generation.status !== 'running') {
    // Delivery retries and reconcile-on-poll can race; the first finalizer
    // wins and replays are acknowledged so the daemon stops retrying.
    return NextResponse.json({ status: 'already-finalized' })
  }

  let job

  try {
    job = parseAgentsDaemonGuideJob(JSON.parse(rawBody))
  } catch {
    return NextResponse.json(
      { error: 'Callback payload is not a valid guide job.' },
      { status: 400 },
    )
  }

  const result = await finalizeCodeReviewGuideGenerationFromJob({
    job,
    snapshotId: generation.snapshotId,
  })

  logCodewalkEvent('codewalk.guide_callback.processed', {
    action: result.action,
    jobId,
    snapshotId: generation.snapshotId,
    ...(result.action === 'finalized' ? { status: result.status } : {}),
  })

  return NextResponse.json({ result })
}
