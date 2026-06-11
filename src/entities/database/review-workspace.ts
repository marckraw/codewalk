import 'server-only'

import { asc, count, desc, eq, inArray } from 'drizzle-orm'
import {
  derivePullRequestLifecycleStatus,
  type PullRequestLifecycleStatus,
} from '@/entities/github'
import { getDb } from './client'
import {
  codeReviewGuideGenerations,
  guideSectionFiles,
  guideSections,
  guides,
  pullRequestFiles,
  pullRequestSnapshots,
  type CodeReviewGuideGenerationRow,
  type CodeReviewGuideRow,
  type CodeReviewGuideSectionFileRow,
  type CodeReviewGuideSectionRow,
} from './schema'

export type ReviewWorkspaceState = 'imported' | 'preparing' | 'ready' | 'failed'

export type ReviewWorkspaceGuideSection = CodeReviewGuideSectionRow & {
  files: CodeReviewGuideSectionFileRow[]
}

export type ReviewWorkspaceGuide = CodeReviewGuideRow & {
  sections: ReviewWorkspaceGuideSection[]
}

export type ReviewWorkspaceData = {
  files: Array<typeof pullRequestFiles.$inferSelect>
  generation: CodeReviewGuideGenerationRow | null
  guide: ReviewWorkspaceGuide | null
  prStatus: PullRequestLifecycleStatus
  snapshot: typeof pullRequestSnapshots.$inferSelect
  state: ReviewWorkspaceState
}

/**
 * Last-resort fallback: generations now run as daemon jobs and the reconciler
 * pulls their real status on every workspace read, so a row only stays
 * "running" this long when the daemon has been unreachable the whole time
 * (or the job submit never happened). Generous on purpose — a busy daemon
 * queue is not a failure.
 */
export const STALE_RUNNING_GENERATION_THRESHOLD_MS = 60 * 60 * 1000

export const STALE_RUNNING_GENERATION_ERROR =
  'Guide generation was interrupted on the server. Retry to start a new run.'

/**
 * Present a generation row for reading: rows stuck in "running" past the
 * staleness threshold are surfaced as failed (read-only — the row itself is
 * not rewritten; a retry overwrites it via the regular start flow).
 */
export function presentCodeReviewGuideGeneration<
  T extends Pick<
    CodeReviewGuideGenerationRow,
    'error' | 'startedAt' | 'status'
  >,
>(generation: T | null, now = new Date()): T | null {
  if (!generation || generation.status !== 'running') {
    return generation
  }

  if (
    now.getTime() - generation.startedAt.getTime() <=
    STALE_RUNNING_GENERATION_THRESHOLD_MS
  ) {
    return generation
  }

  return {
    ...generation,
    error: STALE_RUNNING_GENERATION_ERROR,
    status: 'failed',
  }
}

export function deriveReviewWorkspaceState(input: {
  generation: Pick<CodeReviewGuideGenerationRow, 'status'> | null
  guide: Pick<CodeReviewGuideRow, 'status'> | null
}): ReviewWorkspaceState {
  if (
    input.generation?.status === 'failed' ||
    input.guide?.status === 'failed'
  ) {
    return 'failed'
  }

  if (input.guide?.status === 'ready') {
    return 'ready'
  }

  if (input.generation?.status === 'running') {
    return 'preparing'
  }

  return 'imported'
}

export type ReviewWorkspaceSummary = {
  authorLogin: string | null
  baseRef: string
  fileCount: number
  headRef: string
  id: string
  number: number
  owner: string
  prStatus: PullRequestLifecycleStatus
  prState: string
  repo: string
  status: ReviewWorkspaceState
  title: string
  updatedAt: Date
  url: string
}

const REVIEW_WORKSPACE_LIST_LIMIT = 50

/**
 * List recent PR snapshots with their derived guide status, newest first.
 * Powers the review dashboard so generated reviews can be found without
 * re-importing a PR URL.
 */
export async function listReviewWorkspaces(input?: {
  limit?: number
}): Promise<ReviewWorkspaceSummary[]> {
  const db = getDb()
  const limit = Math.min(
    Math.max(input?.limit ?? REVIEW_WORKSPACE_LIST_LIMIT, 1),
    100,
  )

  const snapshots = await db
    .select()
    .from(pullRequestSnapshots)
    .orderBy(desc(pullRequestSnapshots.updatedAt))
    .limit(limit)

  if (snapshots.length === 0) {
    return []
  }

  const snapshotIds = snapshots.map((snapshot) => snapshot.id)
  const [generations, guideRows, fileCounts] = await Promise.all([
    db
      .select()
      .from(codeReviewGuideGenerations)
      .where(inArray(codeReviewGuideGenerations.snapshotId, snapshotIds)),
    db
      .select({
        snapshotId: guides.snapshotId,
        status: guides.status,
        updatedAt: guides.updatedAt,
      })
      .from(guides)
      .where(inArray(guides.snapshotId, snapshotIds)),
    db
      .select({ snapshotId: pullRequestFiles.snapshotId, total: count() })
      .from(pullRequestFiles)
      .where(inArray(pullRequestFiles.snapshotId, snapshotIds))
      .groupBy(pullRequestFiles.snapshotId),
  ])

  const generationBySnapshot = new Map(
    generations.map((generation) => [generation.snapshotId, generation]),
  )
  const latestGuideBySnapshot = new Map<
    string,
    { status: CodeReviewGuideRow['status']; updatedAt: Date }
  >()
  for (const guide of guideRows) {
    const current = latestGuideBySnapshot.get(guide.snapshotId)
    if (!current || guide.updatedAt > current.updatedAt) {
      latestGuideBySnapshot.set(guide.snapshotId, guide)
    }
  }
  const fileCountBySnapshot = new Map(
    fileCounts.map((row) => [row.snapshotId, Number(row.total)]),
  )

  return snapshots.map((snapshot) => {
    const generation = presentCodeReviewGuideGeneration(
      generationBySnapshot.get(snapshot.id) ?? null,
    )
    const guide = latestGuideBySnapshot.get(snapshot.id) ?? null
    const generationUpdatedAt = generation?.updatedAt ?? null

    return {
      authorLogin: snapshot.authorLogin,
      baseRef: snapshot.baseRef,
      fileCount: fileCountBySnapshot.get(snapshot.id) ?? 0,
      headRef: snapshot.headRef,
      id: snapshot.id,
      number: snapshot.number,
      owner: snapshot.owner,
      prStatus: derivePullRequestLifecycleStatus(snapshot),
      prState: snapshot.state,
      repo: snapshot.repo,
      status: deriveReviewWorkspaceState({ generation, guide }),
      title: snapshot.title,
      updatedAt:
        generationUpdatedAt && generationUpdatedAt > snapshot.updatedAt
          ? generationUpdatedAt
          : snapshot.updatedAt,
      url: snapshot.url,
    }
  })
}

export async function getReviewWorkspace(
  snapshotId: string,
): Promise<ReviewWorkspaceData | null> {
  const db = getDb()
  const [snapshot] = await db
    .select()
    .from(pullRequestSnapshots)
    .where(eq(pullRequestSnapshots.id, snapshotId))
    .limit(1)

  if (!snapshot) {
    return null
  }

  const [files, generationRow] = await Promise.all([
    db
      .select()
      .from(pullRequestFiles)
      .where(eq(pullRequestFiles.snapshotId, snapshotId))
      .orderBy(asc(pullRequestFiles.path)),
    db.query.codeReviewGuideGenerations.findFirst({
      orderBy: desc(codeReviewGuideGenerations.updatedAt),
      where: eq(codeReviewGuideGenerations.snapshotId, snapshotId),
    }),
  ])
  const generation = presentCodeReviewGuideGeneration(generationRow ?? null)

  const guide = await getWorkspaceGuide({
    generation,
    snapshotId,
  })

  return {
    files,
    generation,
    guide,
    prStatus: derivePullRequestLifecycleStatus(snapshot),
    snapshot,
    state: deriveReviewWorkspaceState({
      generation,
      guide,
    }),
  }
}

async function getWorkspaceGuide(input: {
  generation: CodeReviewGuideGenerationRow | null
  snapshotId: string
}): Promise<ReviewWorkspaceGuide | null> {
  const db = getDb()
  const guide = input.generation?.guideId
    ? await db.query.guides.findFirst({
        where: eq(guides.id, input.generation.guideId),
      })
    : await db.query.guides.findFirst({
        orderBy: desc(guides.updatedAt),
        where: eq(guides.snapshotId, input.snapshotId),
      })

  if (!guide) {
    return null
  }

  const sections = await db
    .select()
    .from(guideSections)
    .where(eq(guideSections.guideId, guide.id))
    .orderBy(asc(guideSections.order))

  if (sections.length === 0) {
    return { ...guide, sections: [] }
  }

  const sectionFiles = await db
    .select()
    .from(guideSectionFiles)
    .where(
      inArray(
        guideSectionFiles.guideSectionId,
        sections.map((section) => section.id),
      ),
    )
    .orderBy(asc(guideSectionFiles.order))
  const filesBySectionId = new Map<string, CodeReviewGuideSectionFileRow[]>()

  for (const file of sectionFiles) {
    const current = filesBySectionId.get(file.guideSectionId) ?? []
    current.push(file)
    filesBySectionId.set(file.guideSectionId, current)
  }

  return {
    ...guide,
    sections: sections.map((section) => ({
      ...section,
      files: filesBySectionId.get(section.id) ?? [],
    })),
  }
}
