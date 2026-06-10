import { describe, expect, it } from 'vitest'
import type { ReviewWorkspaceSummary } from '@/entities/database'
import {
  filterReviewWorkspaceSummaries,
  formatAbsoluteReviewDate,
  formatRelativeReviewTime,
  groupReviewWorkspacePullRequestGroupsByRecency,
  groupReviewWorkspacesByPullRequest,
  groupReviewWorkspacesByRecency,
  listReviewWorkspaceRepos,
  matchesReviewSearchQuery,
  normalizeReviewSearchQuery,
  reviewRecencyGroupLabel,
  reviewWorkspacePullRequestKey,
  reviewWorkspaceRepoKey,
} from './review-dashboard.pure'

function summary(
  overrides: Partial<ReviewWorkspaceSummary>,
): ReviewWorkspaceSummary {
  return {
    authorLogin: 'octocat',
    baseRef: 'main',
    fileCount: 3,
    headRef: 'feature',
    id: 'snap-1',
    number: 1,
    owner: 'ef-global',
    prStatus: 'ready_for_review',
    prState: 'open',
    repo: 'backpack',
    status: 'ready',
    title: 'A change',
    updatedAt: new Date('2026-06-09T12:00:00Z'),
    url: 'https://github.com/ef-global/backpack/pull/1',
    ...overrides,
  }
}

describe('reviewWorkspaceRepoKey / listReviewWorkspaceRepos', () => {
  it('derives owner/repo and returns sorted distinct repos', () => {
    const items = [
      summary({ id: 'a', owner: 'ef-global', repo: 'backpack' }),
      summary({ id: 'b', owner: 'ef-global', repo: 'backpack' }),
      summary({ id: 'c', owner: 'acme', repo: 'widgets' }),
    ]

    expect(reviewWorkspaceRepoKey(items[0])).toBe('ef-global/backpack')
    expect(listReviewWorkspaceRepos(items)).toEqual([
      'acme/widgets',
      'ef-global/backpack',
    ])
  })
})

describe('reviewWorkspacePullRequestKey / groupReviewWorkspacesByPullRequest', () => {
  it('groups runs for the same PR and surfaces the latest run', () => {
    const items = [
      summary({
        id: 'old-run',
        number: 186,
        updatedAt: new Date('2026-06-08T12:00:00Z'),
      }),
      summary({
        id: 'other-pr',
        number: 42,
        updatedAt: new Date('2026-06-10T09:00:00Z'),
      }),
      summary({
        id: 'latest-run',
        number: 186,
        updatedAt: new Date('2026-06-10T12:00:00Z'),
      }),
      summary({
        id: 'middle-run',
        number: 186,
        updatedAt: new Date('2026-06-09T12:00:00Z'),
      }),
    ]

    const groups = groupReviewWorkspacesByPullRequest(items)

    expect(reviewWorkspacePullRequestKey(items[0])).toBe(
      'ef-global/backpack#186',
    )
    expect(groups.map((group) => group.id)).toEqual([
      'ef-global/backpack#186',
      'ef-global/backpack#42',
    ])
    expect(groups[0].latest.id).toBe('latest-run')
    expect(groups[0].previous.map((item) => item.id)).toEqual([
      'middle-run',
      'old-run',
    ])
    expect(groups[1].latest.id).toBe('other-pr')
    expect(groups[1].previous).toEqual([])
  })
})

describe('filterReviewWorkspaceSummaries', () => {
  const items = [
    summary({ id: 'a', owner: 'ef-global', repo: 'backpack', status: 'ready' }),
    summary({
      id: 'b',
      owner: 'ef-global',
      repo: 'backpack',
      status: 'preparing',
    }),
    summary({ id: 'c', owner: 'acme', repo: 'widgets', status: 'ready' }),
  ]

  it('returns all with the default filters', () => {
    expect(
      filterReviewWorkspaceSummaries(items, { repo: 'all', status: 'all' }),
    ).toHaveLength(3)
  })

  it('filters by status', () => {
    const ready = filterReviewWorkspaceSummaries(items, {
      repo: 'all',
      status: 'ready',
    })
    expect(ready.map((item) => item.id)).toEqual(['a', 'c'])
  })

  it('filters by repo', () => {
    const acme = filterReviewWorkspaceSummaries(items, {
      repo: 'acme/widgets',
      status: 'all',
    })
    expect(acme.map((item) => item.id)).toEqual(['c'])
  })

  it('combines repo and status filters', () => {
    const result = filterReviewWorkspaceSummaries(items, {
      repo: 'ef-global/backpack',
      status: 'preparing',
    })
    expect(result.map((item) => item.id)).toEqual(['b'])
  })

  it('searches across title, repo, number, branches, and author', () => {
    const searchable = [
      summary({
        authorLogin: 'marckraw',
        headRef: 'fix/header-clip',
        id: 'a',
        number: 186,
        title: 'feat(NavigationBar): add component',
      }),
      summary({
        authorLogin: 'octocat',
        id: 'b',
        number: 42,
        owner: 'acme',
        repo: 'widgets',
        title: 'Fix tooltip overflow',
      }),
    ]

    const byTitle = filterReviewWorkspaceSummaries(searchable, {
      query: 'navigationbar',
      repo: 'all',
      status: 'all',
    })
    expect(byTitle.map((item) => item.id)).toEqual(['a'])

    const byNumber = filterReviewWorkspaceSummaries(searchable, {
      query: '#186',
      repo: 'all',
      status: 'all',
    })
    expect(byNumber.map((item) => item.id)).toEqual(['a'])

    const byRepo = filterReviewWorkspaceSummaries(searchable, {
      query: 'acme/widgets',
      repo: 'all',
      status: 'all',
    })
    expect(byRepo.map((item) => item.id)).toEqual(['b'])

    const byBranch = filterReviewWorkspaceSummaries(searchable, {
      query: 'header-clip',
      repo: 'all',
      status: 'all',
    })
    expect(byBranch.map((item) => item.id)).toEqual(['a'])

    const byAuthor = filterReviewWorkspaceSummaries(searchable, {
      query: 'octocat',
      repo: 'all',
      status: 'all',
    })
    expect(byAuthor.map((item) => item.id)).toEqual(['b'])
  })

  it('requires every search term to match and ignores blank queries', () => {
    const searchable = [
      summary({
        id: 'a',
        number: 186,
        title: 'feat(NavigationBar): add component',
      }),
      summary({ id: 'b', number: 42, title: 'Fix NavigationBar tooltip' }),
    ]

    const combined = filterReviewWorkspaceSummaries(searchable, {
      query: 'navigationbar 186',
      repo: 'all',
      status: 'all',
    })
    expect(combined.map((item) => item.id)).toEqual(['a'])

    const blank = filterReviewWorkspaceSummaries(searchable, {
      query: '   ',
      repo: 'all',
      status: 'all',
    })
    expect(blank).toHaveLength(2)

    const miss = filterReviewWorkspaceSummaries(searchable, {
      query: 'does-not-exist',
      repo: 'all',
      status: 'all',
    })
    expect(miss).toHaveLength(0)
  })
})

describe('normalizeReviewSearchQuery / matchesReviewSearchQuery', () => {
  it('normalizes whitespace and case before matching all terms', () => {
    const item = summary({
      authorLogin: 'Marckraw',
      headRef: 'fix/header-clip',
      number: 186,
      title: 'Fix NavigationBar tooltip',
    })

    const query = normalizeReviewSearchQuery('  NAVIGATIONBAR   #186 ')

    expect(query).toBe('navigationbar   #186')
    expect(matchesReviewSearchQuery(item, query)).toBe(true)
    expect(matchesReviewSearchQuery(item, 'navigationbar missing')).toBe(false)
  })
})

describe('formatRelativeReviewTime', () => {
  const base = new Date('2026-06-09T12:00:00Z')

  it('reports recent updates as just now', () => {
    expect(
      formatRelativeReviewTime(base, new Date('2026-06-09T12:00:30Z')),
    ).toBe('just now')
  })

  it('reports minutes, hours, and days', () => {
    expect(
      formatRelativeReviewTime(base, new Date('2026-06-09T12:30:00Z')),
    ).toBe('30m ago')
    expect(
      formatRelativeReviewTime(base, new Date('2026-06-09T15:00:00Z')),
    ).toBe('3h ago')
    expect(
      formatRelativeReviewTime(base, new Date('2026-06-12T12:00:00Z')),
    ).toBe('3d ago')
  })

  it('falls back to an absolute date beyond a week', () => {
    expect(
      formatRelativeReviewTime(base, new Date('2026-06-20T12:00:00Z')),
    ).toBe('Jun 9, 2026')
  })

  it('accepts ISO strings', () => {
    expect(
      formatRelativeReviewTime(
        '2026-06-09T12:00:00Z',
        new Date('2026-06-09T12:05:00Z'),
      ),
    ).toBe('5m ago')
  })
})

describe('reviewRecencyGroupLabel', () => {
  // Local-time strings (no `Z`) keep the test deterministic across timezones.
  const now = new Date('2026-06-10T15:00:00')

  it("buckets relative to the viewer's local midnight", () => {
    expect(reviewRecencyGroupLabel(new Date('2026-06-10T00:00:00'), now)).toBe(
      'Today',
    )
    expect(reviewRecencyGroupLabel(new Date('2026-06-10T14:59:00'), now)).toBe(
      'Today',
    )
    expect(reviewRecencyGroupLabel(new Date('2026-06-09T23:59:59'), now)).toBe(
      'Yesterday',
    )
    expect(reviewRecencyGroupLabel(new Date('2026-06-09T00:00:00'), now)).toBe(
      'Yesterday',
    )
    expect(reviewRecencyGroupLabel(new Date('2026-06-08T23:59:59'), now)).toBe(
      'This week',
    )
    expect(reviewRecencyGroupLabel(new Date('2026-06-03T00:00:00'), now)).toBe(
      'This week',
    )
    expect(reviewRecencyGroupLabel(new Date('2026-06-02T23:59:59'), now)).toBe(
      'This month',
    )
    expect(reviewRecencyGroupLabel(new Date('2026-05-11T00:00:00'), now)).toBe(
      'This month',
    )
    expect(reviewRecencyGroupLabel(new Date('2026-05-10T23:59:59'), now)).toBe(
      'Older',
    )
  })

  it('accepts ISO strings', () => {
    expect(reviewRecencyGroupLabel('2026-06-10T01:00:00', now)).toBe('Today')
  })
})

describe('groupReviewWorkspacesByRecency', () => {
  const now = new Date('2026-06-10T15:00:00')

  it('returns non-empty buckets in fixed order, preserving item order', () => {
    const items = [
      summary({ id: 'today-1', updatedAt: new Date('2026-06-10T14:00:00') }),
      summary({ id: 'today-2', updatedAt: new Date('2026-06-10T09:00:00') }),
      summary({ id: 'week', updatedAt: new Date('2026-06-05T12:00:00') }),
      summary({ id: 'older', updatedAt: new Date('2026-01-15T12:00:00') }),
    ]

    const groups = groupReviewWorkspacesByRecency(items, now)

    expect(groups.map((group) => group.label)).toEqual([
      'Today',
      'This week',
      'Older',
    ])
    expect(groups[0].items.map((item) => item.id)).toEqual([
      'today-1',
      'today-2',
    ])
    expect(groups[1].items.map((item) => item.id)).toEqual(['week'])
    expect(groups[2].items.map((item) => item.id)).toEqual(['older'])
  })

  it('returns no groups for an empty list', () => {
    expect(groupReviewWorkspacesByRecency([], now)).toEqual([])
  })
})

describe('groupReviewWorkspacePullRequestGroupsByRecency', () => {
  const now = new Date('2026-06-10T15:00:00')

  it('buckets PR groups by their latest run', () => {
    const pullRequestGroups = groupReviewWorkspacesByPullRequest([
      summary({
        id: 'old-run',
        number: 1,
        updatedAt: new Date('2026-06-01T12:00:00'),
      }),
      summary({
        id: 'latest-run',
        number: 1,
        updatedAt: new Date('2026-06-10T12:00:00'),
      }),
      summary({
        id: 'older-pr',
        number: 2,
        updatedAt: new Date('2026-01-15T12:00:00'),
      }),
    ])

    const recencyGroups = groupReviewWorkspacePullRequestGroupsByRecency(
      pullRequestGroups,
      now,
    )

    expect(recencyGroups.map((group) => group.label)).toEqual([
      'Today',
      'Older',
    ])
    expect(recencyGroups[0].groups.map((group) => group.latest.id)).toEqual([
      'latest-run',
    ])
    expect(recencyGroups[1].groups.map((group) => group.latest.id)).toEqual([
      'older-pr',
    ])
  })
})

describe('formatAbsoluteReviewDate', () => {
  it('formats a UTC date deterministically', () => {
    expect(formatAbsoluteReviewDate(new Date('2026-06-09T23:30:00Z'))).toBe(
      'Jun 9, 2026',
    )
  })
})
