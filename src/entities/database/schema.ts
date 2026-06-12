import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const pullRequestFileStatus = pgEnum('pull_request_file_status', [
  'added',
  'modified',
  'removed',
  'renamed',
  'changed',
])

export const codeReviewGuideMode = pgEnum('code_review_guide_mode', [
  'pull-request',
])

export const codeReviewGuideProvider = pgEnum('code_review_guide_provider', [
  'claude',
  'codex',
  'cursor',
  'gemini',
])

export const codeReviewGuideStatus = pgEnum('code_review_guide_status', [
  'ready',
  'failed',
])

export const codeReviewGuideGenerator = pgEnum('code_review_guide_generator', [
  'deterministic',
  'agent',
])

export const codeReviewGuideGenerationStatus = pgEnum(
  'code_review_guide_generation_status',
  ['running', 'ready', 'failed'],
)

export const guideRiskLevel = pgEnum('guide_risk_level', [
  'low',
  'medium',
  'high',
])

export const repositoryReviewRuleType = pgEnum('repository_review_rule_type', [
  'allow',
  'block',
])

export const noteAnchorType = pgEnum('note_anchor_type', [
  'guide_section',
  'file',
  'diff_range',
])

export const reviewProgressTargetType = pgEnum('review_progress_target_type', [
  'guide_section',
  'file',
])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clerkUserId: varchar('clerk_user_id', { length: 191 }).notNull(),
    email: varchar('email', { length: 320 }),
    name: varchar('name', { length: 191 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    clerkUserIdIdx: uniqueIndex('users_clerk_user_id_idx').on(
      table.clerkUserId,
    ),
  }),
)

export const repositoryReviewRules = pgTable(
  'repository_review_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    owner: varchar('owner', { length: 191 }).notNull(),
    repo: varchar('repo', { length: 191 }).notNull(),
    rule: repositoryReviewRuleType('rule').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    repoIdx: uniqueIndex('repository_review_rules_repo_idx').on(
      table.owner,
      table.repo,
    ),
  }),
)

export const pullRequestSnapshots = pgTable(
  'pull_request_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    owner: varchar('owner', { length: 191 }).notNull(),
    repo: varchar('repo', { length: 191 }).notNull(),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    state: varchar('state', { length: 32 }).notNull(),
    draft: boolean('draft').default(false).notNull(),
    mergedAt: timestamp('merged_at', { withTimezone: true }),
    url: text('url').notNull(),
    baseRef: varchar('base_ref', { length: 255 }).notNull(),
    baseSha: varchar('base_sha', { length: 64 }).notNull(),
    headRef: varchar('head_ref', { length: 255 }).notNull(),
    headSha: varchar('head_sha', { length: 64 }).notNull(),
    authorLogin: varchar('author_login', { length: 191 }),
    importedByUserId: uuid('imported_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    importedAt: timestamp('imported_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    githubPrIdx: uniqueIndex('pull_request_snapshots_github_pr_idx').on(
      table.owner,
      table.repo,
      table.number,
      table.headSha,
    ),
    importedByIdx: index('pull_request_snapshots_imported_by_idx').on(
      table.importedByUserId,
    ),
  }),
)

export const pullRequestFiles = pgTable(
  'pull_request_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    previousPath: text('previous_path'),
    status: pullRequestFileStatus('status').notNull(),
    additions: integer('additions').default(0).notNull(),
    deletions: integer('deletions').default(0).notNull(),
    changes: integer('changes').default(0).notNull(),
    patch: text('patch'),
    blobSha: varchar('blob_sha', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    snapshotPathIdx: uniqueIndex('pull_request_files_snapshot_path_idx').on(
      table.snapshotId,
      table.path,
    ),
    snapshotIdx: index('pull_request_files_snapshot_idx').on(table.snapshotId),
  }),
)

export const pullRequestCommits = pgTable(
  'pull_request_commits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: 'cascade' }),
    sha: varchar('sha', { length: 64 }).notNull(),
    message: text('message').notNull(),
    authorName: varchar('author_name', { length: 191 }),
    authorEmail: varchar('author_email', { length: 320 }),
    authoredAt: timestamp('authored_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    snapshotShaIdx: uniqueIndex('pull_request_commits_snapshot_sha_idx').on(
      table.snapshotId,
      table.sha,
    ),
  }),
)

export const pullRequestComments = pgTable(
  'pull_request_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: 'cascade' }),
    githubId: varchar('github_id', { length: 191 }).notNull(),
    type: varchar('type', { length: 64 }).notNull(),
    authorLogin: varchar('author_login', { length: 191 }),
    body: text('body').notNull(),
    path: text('path'),
    line: integer('line'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => ({
    snapshotGithubIdIdx: uniqueIndex(
      'pull_request_comments_snapshot_github_id_idx',
    ).on(table.snapshotId, table.githubId),
    snapshotIdx: index('pull_request_comments_snapshot_idx').on(
      table.snapshotId,
    ),
  }),
)

export const guides = pgTable(
  'guides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    daemonGuideId: varchar('daemon_guide_id', { length: 191 }).notNull(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: 'cascade' }),
    repository: text('repository').notNull(),
    pullRequestNumber: integer('pull_request_number').notNull(),
    targetId: text('target_id').notNull(),
    mode: codeReviewGuideMode('mode').default('pull-request').notNull(),
    cacheKey: text('cache_key').notNull(),
    cacheIdentity: jsonb('cache_identity')
      .$type<CodeReviewCacheIdentity>()
      .notNull(),
    provider: codeReviewGuideProvider('provider').notNull(),
    model: varchar('model', { length: 191 }).notNull(),
    effort: varchar('effort', { length: 191 }),
    status: codeReviewGuideStatus('status').notNull(),
    overview: text('overview').notNull(),
    generatedBy: codeReviewGuideGenerator('generated_by').notNull(),
    error: text('error'),
    pullRequest: jsonb('pull_request')
      .$type<CodeReviewGuidePullRequestMetadata>()
      .notNull(),
    summary: jsonb('summary').$type<CodeReviewGuideSummary>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    daemonGuideIdIdx: uniqueIndex('guides_daemon_guide_id_idx').on(
      table.daemonGuideId,
    ),
    snapshotCacheIdx: uniqueIndex('guides_snapshot_mode_cache_idx').on(
      table.snapshotId,
      table.mode,
      table.cacheKey,
    ),
    targetIdx: index('guides_target_idx').on(
      table.targetId,
      table.mode,
      table.updatedAt,
    ),
  }),
)

export const guideSections = pgTable(
  'guide_sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guideId: uuid('guide_id')
      .notNull()
      .references(() => guides.id, { onDelete: 'cascade' }),
    daemonSectionId: varchar('daemon_section_id', { length: 191 }).notNull(),
    order: integer('order').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    summary: text('summary').notNull(),
    narrative: text('narrative').notNull(),
    riskLevel: guideRiskLevel('risk_level').notNull(),
    riskRationale: text('risk_rationale').notNull(),
    checklist: jsonb('checklist').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    guideOrderIdx: uniqueIndex('guide_sections_guide_order_idx').on(
      table.guideId,
      table.order,
    ),
    guideDaemonSectionIdx: uniqueIndex(
      'guide_sections_guide_daemon_section_idx',
    ).on(table.guideId, table.daemonSectionId),
  }),
)

export const guideSectionFiles = pgTable(
  'guide_section_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guideSectionId: uuid('guide_section_id')
      .notNull()
      .references(() => guideSections.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    path: text('path').notNull(),
    status: varchar('status', { length: 64 }).notNull(),
    reason: text('reason').notNull(),
    hunkHints: jsonb('hunk_hints').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sectionOrderIdx: uniqueIndex('guide_section_files_section_order_idx').on(
      table.guideSectionId,
      table.order,
    ),
    sectionPathIdx: index('guide_section_files_section_path_idx').on(
      table.guideSectionId,
      table.path,
    ),
  }),
)

export const codeReviewGuideGenerations = pgTable(
  'code_review_guide_generations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: 'cascade' }),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    guideId: uuid('guide_id').references(() => guides.id, {
      onDelete: 'set null',
    }),
    provider: codeReviewGuideProvider('provider'),
    model: varchar('model', { length: 191 }),
    effort: varchar('effort', { length: 191 }),
    force: boolean('force').default(false).notNull(),
    status: codeReviewGuideGenerationStatus('status').notNull(),
    error: text('error'),
    githubCommentId: varchar('github_comment_id', { length: 191 }),
    githubCommentUrl: text('github_comment_url'),
    daemonJobId: varchar('daemon_job_id', { length: 191 }),
    daemonCallbackSecret: varchar('daemon_callback_secret', { length: 191 }),
    startedAt: timestamp('started_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    snapshotIdx: uniqueIndex('code_review_guide_generations_snapshot_idx').on(
      table.snapshotId,
    ),
    statusIdx: index('code_review_guide_generations_status_idx').on(
      table.status,
      table.updatedAt,
    ),
  }),
)

export const reviewNotes = pgTable(
  'review_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    guideSectionId: uuid('guide_section_id').references(
      () => guideSections.id,
      { onDelete: 'set null' },
    ),
    anchorType: noteAnchorType('anchor_type').notNull(),
    filePath: text('file_path'),
    lineStart: integer('line_start'),
    lineEnd: integer('line_end'),
    body: text('body').notNull(),
    resolved: boolean('resolved').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    snapshotUserIdx: index('review_notes_snapshot_user_idx').on(
      table.snapshotId,
      table.userId,
    ),
  }),
)

export type CodeReviewGuideMode = 'pull-request'
export type CodeReviewGuideProvider = 'claude' | 'codex' | 'cursor' | 'gemini'
export type CodeReviewGuideStatus = 'ready' | 'failed'
export type CodeReviewGuideGenerator = 'deterministic' | 'agent'
export type CodeReviewGuideGenerationStatus = 'running' | 'ready' | 'failed'
export type CodeReviewGuideRiskLevel = 'low' | 'medium' | 'high'

export type CodeReviewCacheIdentity = {
  comparisonRef: string | null
  comparisonPoint: string | null
  workingTreeVersionToken: string
}

export type CodeReviewGuideFileEntry = {
  status: string
  file: string
  previousFile?: string
}

export type CodeReviewGuideSummary = {
  cacheIdentity: CodeReviewCacheIdentity
  files: CodeReviewGuideFileEntry[]
}

export type CodeReviewGuidePullRequestMetadata = {
  provider: 'github'
  repositoryOwner: string
  repositoryName: string
  number: number
  title: string | null
  url: string
  state: 'open' | 'closed' | 'merged' | 'unknown'
  baseBranch: string
  headBranch: string
  headRepositoryOwner: string | null
  headRepositoryName: string | null
}

export type RepositoryReviewRuleType = 'allow' | 'block'
export type RepositoryReviewRuleRow = typeof repositoryReviewRules.$inferSelect

export type CodeReviewGuideRow = typeof guides.$inferSelect
export type CodeReviewGuideSectionRow = typeof guideSections.$inferSelect
export type CodeReviewGuideSectionFileRow =
  typeof guideSectionFiles.$inferSelect
export type CodeReviewGuideGenerationRow =
  typeof codeReviewGuideGenerations.$inferSelect

export const reviewProgress = pgTable(
  'review_progress',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: reviewProgressTargetType('target_type').notNull(),
    targetId: varchar('target_id', { length: 512 }).notNull(),
    reviewed: boolean('reviewed').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    targetIdx: uniqueIndex('review_progress_target_idx').on(
      table.snapshotId,
      table.userId,
      table.targetType,
      table.targetId,
    ),
  }),
)

export const reviewThreadStatus = pgEnum('review_thread_status', [
  'open',
  'resolved',
  'outdated',
])

export const reviewThreadDiffSide = pgEnum('review_thread_diff_side', [
  'old',
  'new',
])

export const reviewThreadCommentAuthorType = pgEnum(
  'review_thread_comment_author_type',
  ['user', 'agent'],
)

export const reviewThreadAgentState = pgEnum('review_thread_agent_state', [
  'pending',
  'streaming',
  'complete',
  'error',
])

/**
 * Anchored conversation threads on a guided review. Threads belong to the
 * pull request identity (owner/repo/number), not to a snapshot: new pushes
 * create new snapshot rows and threads must survive them (GitHub model).
 * The snapshot and head sha the thread was created against are recorded for
 * outdated detection, and the selected lines are denormalized into `excerpt`
 * so outdated threads stay readable and agent prompts need no diff lookup.
 */
export const reviewThreads = pgTable(
  'review_threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    owner: varchar('owner', { length: 191 }).notNull(),
    repo: varchar('repo', { length: 191 }).notNull(),
    pullRequestNumber: integer('pull_request_number').notNull(),
    anchorSnapshotId: uuid('anchor_snapshot_id').references(
      () => pullRequestSnapshots.id,
      { onDelete: 'set null' },
    ),
    anchorCommitSha: varchar('anchor_commit_sha', { length: 64 }).notNull(),
    filePath: text('file_path').notNull(),
    side: reviewThreadDiffSide('side').default('new').notNull(),
    lineStart: integer('line_start').notNull(),
    lineEnd: integer('line_end').notNull(),
    excerpt: text('excerpt').notNull(),
    status: reviewThreadStatus('status').default('open').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pullRequestIdx: index('review_threads_pull_request_idx').on(
      table.owner,
      table.repo,
      table.pullRequestNumber,
    ),
    statusIdx: index('review_threads_status_idx').on(table.status),
  }),
)

export const reviewThreadComments = pgTable(
  'review_thread_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => reviewThreads.id, { onDelete: 'cascade' }),
    authorType: reviewThreadCommentAuthorType('author_type').notNull(),
    authorUserId: uuid('author_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    agentState: reviewThreadAgentState('agent_state'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    threadIdx: index('review_thread_comments_thread_idx').on(
      table.threadId,
      table.createdAt,
    ),
  }),
)

export type ReviewThreadStatus = 'open' | 'resolved' | 'outdated'
export type ReviewThreadDiffSide = 'old' | 'new'
export type ReviewThreadCommentAuthorType = 'user' | 'agent'
export type ReviewThreadAgentState =
  | 'pending'
  | 'streaming'
  | 'complete'
  | 'error'
export type ReviewThreadRow = typeof reviewThreads.$inferSelect
export type ReviewThreadCommentRow = typeof reviewThreadComments.$inferSelect
