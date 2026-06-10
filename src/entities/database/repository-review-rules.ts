import 'server-only'

import { desc, eq } from 'drizzle-orm'
import type { RepositoryReviewRuleType } from './schema'
import { getDb } from './client'
import { repositoryReviewRules } from './schema'

export type RepositoryReviewRuleInsert = {
  createdByUserId: string | null
  owner: string
  repo: string
  rule: RepositoryReviewRuleType
}

/**
 * Owners and repos are stored lowercase so the unique index doubles as a
 * case-insensitive dedupe (GitHub treats names case-insensitively).
 */
export function buildRepositoryReviewRuleRow(
  input: RepositoryReviewRuleInsert,
) {
  return {
    createdByUserId: input.createdByUserId,
    owner: input.owner.toLowerCase(),
    repo: input.repo.toLowerCase(),
    rule: input.rule,
  }
}

export async function listRepositoryReviewRules() {
  const db = getDb()
  return db
    .select()
    .from(repositoryReviewRules)
    .orderBy(desc(repositoryReviewRules.createdAt))
}

export async function upsertRepositoryReviewRule(
  input: RepositoryReviewRuleInsert,
) {
  const db = getDb()
  const row = buildRepositoryReviewRuleRow(input)
  const [rule] = await db
    .insert(repositoryReviewRules)
    .values(row)
    .onConflictDoUpdate({
      set: {
        createdByUserId: row.createdByUserId,
        rule: row.rule,
        updatedAt: new Date(),
      },
      target: [repositoryReviewRules.owner, repositoryReviewRules.repo],
    })
    .returning()

  return rule
}

export async function deleteRepositoryReviewRule(ruleId: string) {
  const db = getDb()
  const deleted = await db
    .delete(repositoryReviewRules)
    .where(eq(repositoryReviewRules.id, ruleId))
    .returning()

  return deleted.at(0) ?? null
}
