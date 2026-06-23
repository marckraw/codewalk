import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPullRequestSnapshotById,
  listOpenReviewThreadRowsForPullRequest,
  listPullRequestFilePatches,
  setReviewThreadStatus,
} from '@/entities/database'
import { markOutdatedReviewThreadsForSnapshot } from './review-thread-outdated.service'

vi.mock('server-only', () => ({}))

vi.mock('@/entities/database', async () => {
  const actual = await vi.importActual<typeof import('@/entities/database')>(
    '@/entities/database',
  )

  return {
    ...actual,
    getPullRequestSnapshotById: vi.fn(),
    listOpenReviewThreadRowsForPullRequest: vi.fn(),
    listPullRequestFilePatches: vi.fn(),
    setReviewThreadStatus: vi.fn(),
  }
})

const mockedGetSnapshot = vi.mocked(getPullRequestSnapshotById)
const mockedListThreads = vi.mocked(listOpenReviewThreadRowsForPullRequest)
const mockedListPatches = vi.mocked(listPullRequestFilePatches)
const mockedSetStatus = vi.mocked(setReviewThreadStatus)

const newSnapshot = {
  headSha: 'head-2',
  id: 'snap-2',
  number: 42,
  owner: 'ef-global',
  repo: 'backpack',
} as never

function thread(input: {
  anchorCommitSha?: string
  anchorSnapshotId?: string | null
  filePath?: string
  id: string
  kind?: 'inline' | 'discussion'
}) {
  return {
    anchorCommitSha: input.anchorCommitSha ?? 'head-1',
    anchorSnapshotId:
      input.anchorSnapshotId === undefined ? 'snap-1' : input.anchorSnapshotId,
    filePath: input.filePath ?? 'src/a.ts',
    id: input.id,
    kind: input.kind ?? 'inline',
    status: 'open',
  } as never
}

describe('markOutdatedReviewThreadsForSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetSnapshot.mockResolvedValue(newSnapshot)
    mockedSetStatus.mockResolvedValue({} as never)
  })

  it('marks threads whose file diff changed and keeps unchanged ones', async () => {
    mockedListThreads.mockResolvedValue([
      thread({ id: 'thread-changed', filePath: 'src/a.ts' }),
      thread({ id: 'thread-unchanged', filePath: 'src/b.ts' }),
      thread({ id: 'thread-current', anchorCommitSha: 'head-2' }),
    ])
    mockedListPatches.mockImplementation(async (snapshotId: string) =>
      snapshotId === 'snap-2'
        ? new Map([
            ['src/a.ts', 'patch-a-NEW'],
            ['src/b.ts', 'patch-b'],
          ])
        : new Map([
            ['src/a.ts', 'patch-a-OLD'],
            ['src/b.ts', 'patch-b'],
          ]),
    )

    const result = await markOutdatedReviewThreadsForSnapshot({
      snapshotId: 'snap-2',
    })

    expect(result.outdatedThreadIds).toEqual(['thread-changed'])
    expect(mockedSetStatus).toHaveBeenCalledTimes(1)
    expect(mockedSetStatus).toHaveBeenCalledWith('thread-changed', 'outdated')
  })

  it('marks threads conservatively when the anchor snapshot is gone', async () => {
    mockedListThreads.mockResolvedValue([
      thread({ id: 'thread-orphan', anchorSnapshotId: null }),
    ])
    mockedListPatches.mockResolvedValue(new Map([['src/a.ts', 'patch-a']]))

    const result = await markOutdatedReviewThreadsForSnapshot({
      snapshotId: 'snap-2',
    })

    expect(result.outdatedThreadIds).toEqual(['thread-orphan'])
  })

  it('does nothing when every open thread anchors the new head', async () => {
    mockedListThreads.mockResolvedValue([
      thread({ id: 'thread-current', anchorCommitSha: 'head-2' }),
    ])

    const result = await markOutdatedReviewThreadsForSnapshot({
      snapshotId: 'snap-2',
    })

    expect(result.outdatedThreadIds).toEqual([])
    expect(mockedListPatches).not.toHaveBeenCalled()
    expect(mockedSetStatus).not.toHaveBeenCalled()
  })

  it('never marks discussions outdated, even on an older head', async () => {
    mockedListThreads.mockResolvedValue([
      thread({ id: 'discussion-1', kind: 'discussion' }),
    ])

    const result = await markOutdatedReviewThreadsForSnapshot({
      snapshotId: 'snap-2',
    })

    expect(result.outdatedThreadIds).toEqual([])
    expect(mockedListPatches).not.toHaveBeenCalled()
    expect(mockedSetStatus).not.toHaveBeenCalled()
  })

  it('does nothing for unknown snapshots', async () => {
    mockedGetSnapshot.mockResolvedValue(null)

    const result = await markOutdatedReviewThreadsForSnapshot({
      snapshotId: 'missing',
    })

    expect(result.outdatedThreadIds).toEqual([])
    expect(mockedListThreads).not.toHaveBeenCalled()
  })
})
