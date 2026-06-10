export type RepositoryReviewRuleInput = {
  owner: string
  repo: string
  rule: 'allow' | 'block'
}

export type RepositoryReviewAccess =
  | {
      allowed: true
      source: 'allowed-owner' | 'allowlist'
    }
  | {
      allowed: false
      reason: 'blocklisted' | 'not-allowlisted'
    }

/**
 * Decide whether a repository participates in guided reviews. A block rule
 * always wins (it can exclude repos inside the allowed owner). Repos under
 * the allowed owner are enabled by default; anything else needs an allow rule.
 */
export function evaluateRepositoryReviewAccess(input: {
  allowedOwner: string
  owner: string
  repo: string
  rules: RepositoryReviewRuleInput[]
}): RepositoryReviewAccess {
  const owner = input.owner.toLowerCase()
  const repo = input.repo.toLowerCase()
  const matchingRule = input.rules.find(
    (rule) =>
      rule.owner.toLowerCase() === owner && rule.repo.toLowerCase() === repo,
  )

  if (matchingRule?.rule === 'block') {
    return { allowed: false, reason: 'blocklisted' }
  }

  if (owner === input.allowedOwner.toLowerCase()) {
    return { allowed: true, source: 'allowed-owner' }
  }

  if (matchingRule?.rule === 'allow') {
    return { allowed: true, source: 'allowlist' }
  }

  return { allowed: false, reason: 'not-allowlisted' }
}
