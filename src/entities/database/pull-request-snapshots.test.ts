import { describe, expect, it, vi } from 'vitest'
import type { NormalizedPullRequestSnapshot } from '@/entities/github'
import { buildPullRequestSnapshotRows } from './pull-request-snapshots'

vi.mock('server-only', () => ({}))

describe('buildPullRequestSnapshotRows', () => {
  it('maps normalized GitHub data into database insert rows', () => {
    const rows = buildPullRequestSnapshotRows({
      importedByUserId: 'user-id',
      snapshot: fixtureSnapshot,
    })

    expect(rows.snapshot).toMatchObject({
      authorLogin: 'octocat',
      baseRef: 'main',
      baseSha: 'base-sha',
      draft: false,
      headRef: 'feature',
      headSha: 'head-sha',
      importedByUserId: 'user-id',
      mergedAt: null,
      number: 24,
      owner: 'openai',
      repo: 'codex',
      state: 'open',
      title: 'Import pull request snapshots',
      url: 'https://github.com/openai/codex/pull/24',
    })
    expect(rows.files).toEqual([
      {
        additions: 2,
        blobSha: 'blob-sha',
        changes: 3,
        deletions: 1,
        patch: '@@ -1 +1 @@',
        path: 'src/importer.ts',
        previousPath: null,
        status: 'modified',
      },
    ])
    expect(rows.commits[0]).toMatchObject({
      authorEmail: 'octocat@example.com',
      authorName: 'Octocat',
      message: 'Implement importer',
      sha: 'commit-sha',
    })
    expect(rows.comments[0]).toMatchObject({
      authorLogin: 'reviewer',
      body: 'Looks good',
      githubId: 'issue:1',
      type: 'issue_comment',
    })
    expect(rows.commits[0].authoredAt).toBeInstanceOf(Date)
    expect(rows.comments[0].createdAt).toBeInstanceOf(Date)
  })

  it('uses the GitHub PR activity time as updatedAt, not persist time', () => {
    const rows = buildPullRequestSnapshotRows({
      importedByUserId: 'user-id',
      snapshot: fixtureSnapshot,
    })

    expect(rows.snapshot.updatedAt).toEqual(new Date('2026-01-02T10:00:00Z'))
  })
})

const fixtureSnapshot: NormalizedPullRequestSnapshot = {
  comments: [
    {
      authorLogin: 'reviewer',
      body: 'Looks good',
      createdAt: '2026-01-04T10:00:00Z',
      githubId: 'issue:1',
      line: null,
      path: null,
      type: 'issue_comment',
      updatedAt: '2026-01-04T11:00:00Z',
      url: 'https://github.com/openai/codex/pull/24#issuecomment-1',
    },
  ],
  commits: [
    {
      authorEmail: 'octocat@example.com',
      authorLogin: 'octocat',
      authorName: 'Octocat',
      authoredAt: '2026-01-03T10:00:00Z',
      message: 'Implement importer',
      sha: 'commit-sha',
    },
  ],
  files: [
    {
      additions: 2,
      blobSha: 'blob-sha',
      changes: 3,
      deletions: 1,
      patch: '@@ -1 +1 @@',
      path: 'src/importer.ts',
      previousPath: null,
      status: 'modified',
    },
  ],
  pullRequest: {
    authorLogin: 'octocat',
    baseRef: 'main',
    baseSha: 'base-sha',
    body: null,
    createdAt: '2026-01-01T10:00:00Z',
    draft: false,
    headRef: 'feature',
    headSha: 'head-sha',
    mergedAt: null,
    number: 24,
    owner: 'openai',
    repo: 'codex',
    state: 'open',
    title: 'Import pull request snapshots',
    updatedAt: '2026-01-02T10:00:00Z',
    url: 'https://github.com/openai/codex/pull/24',
  },
}
