import 'server-only'

import { eq } from 'drizzle-orm'
import { getDb } from './client'
import {
  codeReviewGuideGenerations,
  type CodeReviewGuideGenerationRow,
  type CodeReviewGuideGenerationStatus,
  type CodeReviewGuideProvider,
} from './schema'

export type StartCodeReviewGuideGenerationInput = {
  effort: string | null
  force: boolean
  model: string | null
  provider: CodeReviewGuideProvider | null
  requestedByUserId: string | null
  snapshotId: string
}

export type FinishCodeReviewGuideGenerationInput = {
  error: string | null
  guideId: string | null
  snapshotId: string
  status: Exclude<CodeReviewGuideGenerationStatus, 'running'>
}

export type UpdateCodeReviewGuideGenerationCommentInput = {
  githubCommentId: string
  githubCommentUrl: string | null
  snapshotId: string
}

export function buildStartCodeReviewGuideGenerationRow(
  input: StartCodeReviewGuideGenerationInput,
  now = new Date(),
) {
  return {
    effort: input.effort,
    error: null,
    finishedAt: null,
    force: input.force,
    guideId: null,
    githubCommentId: null,
    githubCommentUrl: null,
    model: input.model,
    provider: input.provider,
    requestedByUserId: input.requestedByUserId,
    snapshotId: input.snapshotId,
    startedAt: now,
    status: 'running' as const,
    updatedAt: now,
  }
}

export function buildFinishCodeReviewGuideGenerationRow(
  input: FinishCodeReviewGuideGenerationInput,
  now = new Date(),
) {
  return {
    error: input.error,
    finishedAt: now,
    guideId: input.guideId,
    status: input.status,
    updatedAt: now,
  }
}

export async function startCodeReviewGuideGeneration(
  input: StartCodeReviewGuideGenerationInput,
): Promise<CodeReviewGuideGenerationRow> {
  const db = getDb()
  const row = buildStartCodeReviewGuideGenerationRow(input)

  const [generation] = await db
    .insert(codeReviewGuideGenerations)
    .values(row)
    .onConflictDoUpdate({
      set: {
        effort: row.effort,
        error: row.error,
        finishedAt: row.finishedAt,
        force: row.force,
        guideId: row.guideId,
        // Preserve GitHub comment fields on retries so the webhook can update
        // the existing Codewalk-owned PR comment instead of creating another.
        model: row.model,
        provider: row.provider,
        requestedByUserId: row.requestedByUserId,
        startedAt: row.startedAt,
        status: row.status,
        updatedAt: row.updatedAt,
      },
      target: codeReviewGuideGenerations.snapshotId,
    })
    .returning()

  return generation
}

export async function updateCodeReviewGuideGenerationComment(
  input: UpdateCodeReviewGuideGenerationCommentInput,
): Promise<CodeReviewGuideGenerationRow> {
  const db = getDb()
  const [generation] = await db
    .update(codeReviewGuideGenerations)
    .set({
      githubCommentId: input.githubCommentId,
      githubCommentUrl: input.githubCommentUrl,
      updatedAt: new Date(),
    })
    .where(eq(codeReviewGuideGenerations.snapshotId, input.snapshotId))
    .returning()

  if (!generation) {
    throw new Error('Code review guide generation was not started.')
  }

  return generation
}

export async function finishCodeReviewGuideGeneration(
  input: FinishCodeReviewGuideGenerationInput,
): Promise<CodeReviewGuideGenerationRow> {
  const db = getDb()
  const row = buildFinishCodeReviewGuideGenerationRow(input)
  const [generation] = await db
    .update(codeReviewGuideGenerations)
    .set(row)
    .where(eq(codeReviewGuideGenerations.snapshotId, input.snapshotId))
    .returning()

  if (!generation) {
    throw new Error('Code review guide generation was not started.')
  }

  return generation
}
