import { after, NextResponse } from 'next/server'
import {
  CodeReviewGuideGenerationError,
  startCodeReviewGuideGenerationRun,
} from '@/features/code-review-guide-generation'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import { upsertAuthenticatedUser } from '@/entities/database'

export const maxDuration = 800
export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body must be JSON.' },
      { status: 400 },
    )
  }

  const snapshotId =
    typeof body === 'object' && body && 'snapshotId' in body
      ? body.snapshotId
      : null
  const force =
    typeof body === 'object' && body && 'force' in body ? body.force : undefined

  if (typeof snapshotId !== 'string' || !snapshotId.trim()) {
    return NextResponse.json(
      { error: 'A pull request snapshot id is required.' },
      { status: 400 },
    )
  }

  if (force !== undefined && typeof force !== 'boolean') {
    return NextResponse.json(
      { error: 'force must be a boolean when provided.' },
      { status: 400 },
    )
  }

  const currentUser = await getCurrentCodewalkUser()

  if (currentUser.status === 'misconfigured') {
    return NextResponse.json(
      {
        error: `Clerk is not configured. Missing: ${currentUser.missingKeys.join(', ')}.`,
      },
      { status: 503 },
    )
  }

  if (currentUser.status === 'signed-out') {
    return NextResponse.json(
      { error: 'Sign in before generating a guided review.' },
      { status: 401 },
    )
  }

  try {
    const user = await upsertAuthenticatedUser({
      clerkUserId: currentUser.userId,
      email: currentUser.email,
      name: currentUser.name,
    })
    const run = await startCodeReviewGuideGenerationRun({
      force,
      requestedByUserId: user.id,
      snapshotId,
    })

    // Finish the daemon round-trip after the response is sent. The generation
    // row is already persisted as "running", so reloading or closing the app
    // does not lose the run — the workspace keeps polling until the row turns
    // ready or failed.
    after(async () => {
      try {
        await run.complete()
      } catch {
        // Failures are persisted on the generation row and logged by the
        // generation pipeline; there is no response left to surface them on.
      }
    })

    return NextResponse.json(
      {
        generation: {
          error: run.generation.error,
          guideId: run.generation.guideId,
          id: run.generation.id,
          status: run.generation.status,
        },
        status: 'preparing',
      },
      { status: 202 },
    )
  } catch (error) {
    if (error instanceof CodeReviewGuideGenerationError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status },
      )
    }

    throw error
  }
}
