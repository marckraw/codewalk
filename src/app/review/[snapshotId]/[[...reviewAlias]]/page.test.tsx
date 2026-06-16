import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
)
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
)

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}))

vi.mock('@/features/auth', () => ({
  AuthControls: () => <div data-testid="auth-controls" />,
}))

vi.mock('@/features/code-review-guide-generation-control', () => ({
  CodeReviewGuideGenerationControl: () => (
    <button type="button">Regenerate</button>
  ),
}))

vi.mock('@/features/theme-toggle', () => ({
  ThemeModeToggle: () => <div data-testid="theme-toggle" />,
}))

vi.mock('@/features/code-review-guide-generation', () => ({
  reconcileCodeReviewGuideGenerationForSnapshot: vi.fn(),
}))

vi.mock('@/entities/auth-server', () => ({
  getCurrentCodewalkUser: vi.fn(),
}))

vi.mock('@/entities/database', () => ({
  getLatestPullRequestSnapshotByRef: vi.fn(),
  getReviewWorkspace: vi.fn(),
}))

import { getCurrentCodewalkUser } from '@/entities/auth-server'
import {
  getLatestPullRequestSnapshotByRef,
  getReviewWorkspace,
} from '@/entities/database'
import ReviewSnapshotPage, {
  buildReviewPullRequestAliasRedirectPath,
} from './page'

describe('ReviewSnapshotPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      email: 'reviewer@example.com',
      name: 'Reviewer',
      status: 'authenticated',
      userId: 'clerk-user-id',
    })
    vi.mocked(getReviewWorkspace).mockResolvedValue(fixtureWorkspace as never)
  })

  it('renders a persisted snapshot and ready daemon guide', async () => {
    render(
      await ReviewSnapshotPage({
        params: Promise.resolve({ snapshotId: 'snapshot-id' }),
      }),
    )

    // The PR title heads both the workspace header and the new "00" overview
    // section, so it legitimately appears more than once.
    expect(screen.getAllByText('Add guided review').length).toBeGreaterThan(0)
    expect(screen.getByText(/ef-global\/example/)).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /Guide/ }).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Guide persistence').length).toBeGreaterThan(0)
    expect(
      screen.getByText('The persistence model follows agents-daemon.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('src/lib/db/schema.ts').length).toBeGreaterThan(
      0,
    )
    expect(screen.getAllByText('Guide schema changed.').length).toBeGreaterThan(
      0,
    )
  })

  it('renders auth-required state when called without an authenticated user', async () => {
    vi.mocked(getCurrentCodewalkUser).mockResolvedValue({
      status: 'signed-out',
    })

    render(
      await ReviewSnapshotPage({
        params: Promise.resolve({ snapshotId: 'snapshot-id' }),
      }),
    )

    expect(screen.getByText('Protected review')).toBeInTheDocument()
    expect(getReviewWorkspace).not.toHaveBeenCalled()
  })

  it('loads review data for any authenticated Codewalk user', async () => {
    render(
      await ReviewSnapshotPage({
        params: Promise.resolve({ snapshotId: 'snapshot-id' }),
      }),
    )

    expect(getReviewWorkspace).toHaveBeenCalledWith('snapshot-id')
  })

  it('redirects a GitHub-shaped alias to the matching snapshot review', async () => {
    vi.mocked(getLatestPullRequestSnapshotByRef).mockResolvedValue({
      id: 'snapshot-id',
    } as never)

    await expect(
      ReviewSnapshotPage({
        params: Promise.resolve({
          reviewAlias: ['backpack', 'pull', '2083'],
          snapshotId: 'ef-global',
        }),
        searchParams: Promise.resolve({ section: 'section-id' }),
      }),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/review/snapshot-id?section=section-id&view=guide',
    )

    expect(getLatestPullRequestSnapshotByRef).toHaveBeenCalledWith({
      number: 2083,
      owner: 'ef-global',
      repo: 'backpack',
    })
    expect(getReviewWorkspace).not.toHaveBeenCalled()
  })

  it('returns not found for invalid pull request aliases', async () => {
    await expect(
      ReviewSnapshotPage({
        params: Promise.resolve({
          reviewAlias: ['backpack', 'pull', '0'],
          snapshotId: 'ef-global',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(getLatestPullRequestSnapshotByRef).not.toHaveBeenCalled()
    expect(getReviewWorkspace).not.toHaveBeenCalled()
  })

  it('returns not found when no snapshot exists for the pull request', async () => {
    vi.mocked(getLatestPullRequestSnapshotByRef).mockResolvedValue(null)

    await expect(
      ReviewSnapshotPage({
        params: Promise.resolve({
          reviewAlias: ['backpack', 'pull', '2083'],
          snapshotId: 'ef-global',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(getReviewWorkspace).not.toHaveBeenCalled()
  })
})

describe('buildReviewPullRequestAliasRedirectPath', () => {
  it('preserves explicit deep-link params and keeps the requested view', () => {
    expect(
      buildReviewPullRequestAliasRedirectPath({
        searchParams: { file: 'src/app/page.tsx', view: 'diff' },
        snapshotId: 'snapshot-id',
      }),
    ).toBe('/review/snapshot-id?file=src%2Fapp%2Fpage.tsx&view=diff')
  })

  it('defaults readable aliases to the guide view', () => {
    expect(
      buildReviewPullRequestAliasRedirectPath({
        searchParams: {},
        snapshotId: 'snapshot-id',
      }),
    ).toBe('/review/snapshot-id?view=guide')
  })

  it('encodes snapshot ids and repeated query params', () => {
    expect(
      buildReviewPullRequestAliasRedirectPath({
        searchParams: { section: ['a', 'b'] },
        snapshotId: 'snapshot id',
      }),
    ).toBe('/review/snapshot%20id?section=a&section=b&view=guide')
  })
})

const now = new Date('2026-06-09T08:00:00.000Z')

const fixtureWorkspace = {
  files: [
    {
      additions: 12,
      blobSha: 'blob-sha',
      changes: 14,
      createdAt: now,
      deletions: 2,
      id: 'file-id',
      patch: '+export const guides = pgTable(',
      path: 'src/lib/db/schema.ts',
      previousPath: null,
      snapshotId: 'snapshot-id',
      status: 'modified',
    },
  ],
  generation: {
    createdAt: now,
    effort: 'high',
    error: null,
    finishedAt: now,
    force: false,
    guideId: 'guide-id',
    id: 'generation-id',
    model: 'gpt-5.4',
    provider: 'codex',
    requestedByUserId: 'user-id',
    snapshotId: 'snapshot-id',
    startedAt: now,
    status: 'ready',
    updatedAt: now,
  },
  guide: {
    cacheIdentity: {
      comparisonPoint: 'base-sha',
      comparisonRef: 'main',
      workingTreeVersionToken: 'head-sha',
    },
    cacheKey: 'cache-key',
    createdAt: now,
    daemonGuideId: 'daemon-guide-id',
    effort: 'high',
    error: null,
    generatedBy: 'agent',
    id: 'guide-id',
    mode: 'pull-request',
    model: 'gpt-5.4',
    overview: 'Review persistence and API boundaries.',
    provider: 'codex',
    pullRequest: {
      baseBranch: 'main',
      headBranch: 'feature',
      headRepositoryName: 'example',
      headRepositoryOwner: 'ef-global',
      number: 42,
      provider: 'github',
      repositoryName: 'example',
      repositoryOwner: 'ef-global',
      state: 'open',
      title: 'Add guided review',
      url: 'https://github.com/ef-global/example/pull/42',
    },
    pullRequestNumber: 42,
    repository: 'https://github.com/ef-global/example',
    sections: [
      {
        checklist: ['Check migration'],
        createdAt: now,
        daemonSectionId: 'section-1',
        files: [
          {
            createdAt: now,
            guideSectionId: 'section-row-id',
            hunkHints: ['@@ -1 +1 @@'],
            id: 'section-file-id',
            order: 0,
            path: 'src/lib/db/schema.ts',
            reason: 'Guide schema changed.',
            status: 'modified',
          },
        ],
        guideId: 'guide-id',
        id: 'section-row-id',
        narrative: 'The persistence model follows agents-daemon.',
        order: 0,
        riskLevel: 'medium',
        riskRationale: 'Persistence contract changed.',
        summary: 'Guide schema changed.',
        title: 'Guide persistence',
      },
    ],
    snapshotId: 'snapshot-id',
    status: 'ready',
    summary: {
      cacheIdentity: {
        comparisonPoint: 'base-sha',
        comparisonRef: 'main',
        workingTreeVersionToken: 'head-sha',
      },
      files: [],
    },
    targetId: 'pull-request:https://github.com/ef-global/example#42',
    updatedAt: now,
  },
  prStatus: 'ready_for_review',
  snapshot: {
    authorLogin: 'octocat',
    baseRef: 'main',
    baseSha: 'base-sha',
    createdAt: now,
    draft: false,
    headRef: 'feature',
    headSha: 'head-sha',
    id: 'snapshot-id',
    importedAt: now,
    importedByUserId: 'user-id',
    mergedAt: null,
    number: 42,
    owner: 'ef-global',
    repo: 'example',
    state: 'open',
    title: 'Add guided review',
    updatedAt: now,
    url: 'https://github.com/ef-global/example/pull/42',
  },
  state: 'ready',
}
