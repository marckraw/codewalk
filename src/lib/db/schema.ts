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
} from "drizzle-orm/pg-core";

export const pullRequestFileStatus = pgEnum("pull_request_file_status", [
  "added",
  "modified",
  "removed",
  "renamed",
  "changed",
]);

export const guideRiskLevel = pgEnum("guide_risk_level", ["low", "medium", "high"]);

export const noteAnchorType = pgEnum("note_anchor_type", ["guide_section", "file", "diff_range"]);

export const reviewProgressTargetType = pgEnum("review_progress_target_type", ["guide_section", "file"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
    email: varchar("email", { length: 320 }),
    name: varchar("name", { length: 191 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    clerkUserIdIdx: uniqueIndex("users_clerk_user_id_idx").on(table.clerkUserId),
  }),
);

export const pullRequestSnapshots = pgTable(
  "pull_request_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    owner: varchar("owner", { length: 191 }).notNull(),
    repo: varchar("repo", { length: 191 }).notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    state: varchar("state", { length: 32 }).notNull(),
    url: text("url").notNull(),
    baseRef: varchar("base_ref", { length: 255 }).notNull(),
    baseSha: varchar("base_sha", { length: 64 }).notNull(),
    headRef: varchar("head_ref", { length: 255 }).notNull(),
    headSha: varchar("head_sha", { length: 64 }).notNull(),
    authorLogin: varchar("author_login", { length: 191 }),
    importedByUserId: uuid("imported_by_user_id").references(() => users.id, { onDelete: "set null" }),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    githubPrIdx: uniqueIndex("pull_request_snapshots_github_pr_idx").on(table.owner, table.repo, table.number, table.headSha),
    importedByIdx: index("pull_request_snapshots_imported_by_idx").on(table.importedByUserId),
  }),
);

export const pullRequestFiles = pgTable(
  "pull_request_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    previousPath: text("previous_path"),
    status: pullRequestFileStatus("status").notNull(),
    additions: integer("additions").default(0).notNull(),
    deletions: integer("deletions").default(0).notNull(),
    changes: integer("changes").default(0).notNull(),
    patch: text("patch"),
    blobSha: varchar("blob_sha", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    snapshotPathIdx: uniqueIndex("pull_request_files_snapshot_path_idx").on(table.snapshotId, table.path),
    snapshotIdx: index("pull_request_files_snapshot_idx").on(table.snapshotId),
  }),
);

export const pullRequestCommits = pgTable(
  "pull_request_commits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: "cascade" }),
    sha: varchar("sha", { length: 64 }).notNull(),
    message: text("message").notNull(),
    authorName: varchar("author_name", { length: 191 }),
    authorEmail: varchar("author_email", { length: 320 }),
    authoredAt: timestamp("authored_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    snapshotShaIdx: uniqueIndex("pull_request_commits_snapshot_sha_idx").on(table.snapshotId, table.sha),
  }),
);

export const pullRequestComments = pgTable(
  "pull_request_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: "cascade" }),
    githubId: varchar("github_id", { length: 191 }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    authorLogin: varchar("author_login", { length: 191 }),
    body: text("body").notNull(),
    path: text("path"),
    line: integer("line"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    snapshotGithubIdIdx: uniqueIndex("pull_request_comments_snapshot_github_id_idx").on(table.snapshotId, table.githubId),
    snapshotIdx: index("pull_request_comments_snapshot_idx").on(table.snapshotId),
  }),
);

export const guides = pgTable(
  "guides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: "cascade" }),
    model: varchar("model", { length: 191 }).notNull(),
    overview: jsonb("overview").$type<{
      behaviorChanges: string[];
      purpose: string;
      risks: string[];
      tests: string[];
      touchedDomains: string[];
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    snapshotIdx: uniqueIndex("guides_snapshot_idx").on(table.snapshotId),
  }),
);

export const guideSections = pgTable(
  "guide_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guideId: uuid("guide_id")
      .notNull()
      .references(() => guides.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary").notNull(),
    riskLevel: guideRiskLevel("risk_level").notNull(),
    filePaths: jsonb("file_paths").$type<string[]>().notNull(),
    checklist: jsonb("checklist").$type<string[]>().notNull(),
    keyHunks: jsonb("key_hunks").$type<Array<{ filePath: string; lineStart?: number; lineEnd?: number }>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    guideOrderIdx: uniqueIndex("guide_sections_guide_order_idx").on(table.guideId, table.order),
  }),
);

export const reviewNotes = pgTable(
  "review_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    guideSectionId: uuid("guide_section_id").references(() => guideSections.id, { onDelete: "set null" }),
    anchorType: noteAnchorType("anchor_type").notNull(),
    filePath: text("file_path"),
    lineStart: integer("line_start"),
    lineEnd: integer("line_end"),
    body: text("body").notNull(),
    resolved: boolean("resolved").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    snapshotUserIdx: index("review_notes_snapshot_user_idx").on(table.snapshotId, table.userId),
  }),
);

export const reviewProgress = pgTable(
  "review_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => pullRequestSnapshots.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: reviewProgressTargetType("target_type").notNull(),
    targetId: varchar("target_id", { length: 512 }).notNull(),
    reviewed: boolean("reviewed").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    targetIdx: uniqueIndex("review_progress_target_idx").on(table.snapshotId, table.userId, table.targetType, table.targetId),
  }),
);
