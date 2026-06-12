import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewThread } from '@/entities/review-thread'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'
import type { ReviewWorkspace as ReviewWorkspaceModel } from './review-types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))

// Stub the heavy Pierre-backed leaves so we exercise the orchestration only.
vi.mock('@/entities/review-thread', async () => {
  const actual = await vi.importActual<
    typeof import('@/entities/review-thread')
  >('@/entities/review-thread')

  return {
    ...actual,
    addReviewThreadComment: vi.fn(),
    createReviewThread: vi.fn(),
    fetchReviewAgentSessionStatus: vi.fn(() =>
      Promise.resolve({ activity: 'tool:Read', state: 'running' as const }),
    ),
    listReviewThreads: vi.fn(() => Promise.resolve([])),
    requestReviewThreadAgentReply: vi.fn(),
    updateReviewThreadStatus: vi.fn(),
  }
})

vi.mock('./pierre-diff-viewer', () => ({
  PierreDiffViewer: ({
    file,
    lineAnnotations = [],
    onSelectedLinesChange,
    renderAnnotation,
  }: {
    file: string | null
    lineAnnotations?: Array<{ metadata: ReviewThreadAnnotationData }>
    onSelectedLinesChange?: (range: {
      end: number
      side: 'additions'
      start: number
    }) => void
    renderAnnotation?: (annotation: {
      metadata: ReviewThreadAnnotationData
    }) => ReactNode
  }) => (
    <div data-testid="diff-pane">
      <span>{file ?? 'no-file'}</span>
      <button
        onClick={() =>
          onSelectedLinesChange?.({ end: 1, side: 'additions', start: 1 })
        }
        type="button"
      >
        Select line 1
      </button>
      {lineAnnotations.map((annotation, index) => (
        <div data-testid="diff-annotation" key={index}>
          {renderAnnotation?.(annotation)}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('./changed-files-tree', () => ({
  ChangedFilesTree: ({
    files,
    onSelectFile,
  }: {
    files: { file: string }[]
    onSelectFile?: (path: string) => void
  }) => (
    <div data-testid="file-tree">
      {files.map((entry) => (
        <button
          key={entry.file}
          onClick={() => onSelectFile?.(entry.file)}
          type="button"
        >
          {entry.file}
        </button>
      ))}
    </div>
  ),
}))

import { ReviewWorkspace } from './review-workspace'
import {
  createReviewThread,
  listReviewThreads,
  requestReviewThreadAgentReply,
} from '@/entities/review-thread'

const mockedCreateReviewThread = vi.mocked(createReviewThread)
const mockedListReviewThreads = vi.mocked(listReviewThreads)
const mockedRequestReviewThreadAgentReply = vi.mocked(
  requestReviewThreadAgentReply,
)

function makeWorkspace(): ReviewWorkspaceModel {
  return {
    files: [
      {
        id: 'f1',
        path: 'src/a.ts',
        status: 'modified',
        patch: '@@ -1 +1 @@\n-a\n+b',
      },
      {
        id: 'f2',
        path: 'src/b.ts',
        status: 'added',
        patch: '@@ -0,0 +1 @@\n+x',
      },
    ],
    generation: null,
    guide: {
      generatedBy: 'agent',
      sections: [
        {
          checklist: ['check one'],
          files: [
            { order: 0, path: 'src/a.ts', reason: 'why', status: 'modified' },
          ],
          id: 'sec-1',
          narrative: 'Section narrative',
          riskLevel: 'low',
          riskRationale: 'Low risk',
          summary: 'Section summary',
          title: 'First section',
        },
      ],
    },
    prStatus: 'ready_for_review',
    snapshot: {
      baseRef: 'main',
      headSha: 'head-sha',
      headRef: 'feature',
      id: 'snap-1',
      number: 7,
      owner: 'ef-global',
      repo: 'backpack',
      title: 'A pull request',
      url: 'https://github.com/ef-global/backpack/pull/7',
    },
    state: 'ready',
  } as unknown as ReviewWorkspaceModel
}

describe('ReviewWorkspace', () => {
  beforeEach(() => {
    mockedCreateReviewThread.mockReset()
    mockedListReviewThreads.mockReset()
    mockedListReviewThreads.mockResolvedValue([])
    mockedRequestReviewThreadAgentReply.mockReset()
    mockedRequestReviewThreadAgentReply.mockImplementation(
      async (threadId: string) => makeAnsweredReviewThread(threadId),
    )
  })

  afterEach(() => cleanup())

  it('defaults to the guide view when a guide exists', () => {
    render(<ReviewWorkspace autoGenerate={false} workspace={makeWorkspace()} />)

    expect(
      screen.getByRole('heading', { name: 'First section' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('file-tree')).not.toBeInTheDocument()
  })

  it('switches to the diff view and shows the selected file', async () => {
    const user = userEvent.setup()
    render(<ReviewWorkspace autoGenerate={false} workspace={makeWorkspace()} />)

    await user.click(screen.getByRole('button', { name: /Diff/ }))

    expect(screen.getByTestId('file-tree')).toBeInTheDocument()
    // First file is selected by default.
    expect(screen.getByTestId('diff-pane')).toHaveTextContent('src/a.ts')

    await user.click(
      within(screen.getByTestId('file-tree')).getByRole('button', {
        name: 'src/b.ts',
      }),
    )
    expect(screen.getByTestId('diff-pane')).toHaveTextContent('src/b.ts')
  })

  it('opens directly to a deep-linked diff file', () => {
    render(
      <ReviewWorkspace
        autoGenerate={false}
        deepLink={{ filePath: 'src/b.ts', sectionId: null, view: 'diff' }}
        workspace={makeWorkspace()}
      />,
    )

    expect(screen.getByTestId('diff-pane')).toHaveTextContent('src/b.ts')
  })

  it('renders status filter counts in the diff view', async () => {
    const user = userEvent.setup()
    render(<ReviewWorkspace autoGenerate={false} workspace={makeWorkspace()} />)

    await user.click(screen.getByRole('button', { name: /Diff/ }))

    expect(screen.getByRole('button', { name: /added 1/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /modified 1/ }),
    ).toBeInTheDocument()
  })

  it('renders existing review threads as diff annotations', async () => {
    const user = userEvent.setup()
    mockedListReviewThreads.mockResolvedValue([makeReviewThread()])

    render(<ReviewWorkspace autoGenerate={false} workspace={makeWorkspace()} />)

    await user.click(screen.getByRole('button', { name: /Diff/ }))

    expect(await screen.findByText(/Thread on new line 1/)).toBeInTheDocument()
    expect(screen.getByText('Why did this change?')).toBeInTheDocument()
  })

  it('creates a review thread from a selected diff line', async () => {
    const user = userEvent.setup()
    mockedCreateReviewThread.mockResolvedValue(
      makeReviewThread({ body: 'What guarantees this path?' }),
    )

    render(<ReviewWorkspace autoGenerate={false} workspace={makeWorkspace()} />)

    await user.click(screen.getByRole('button', { name: /Diff/ }))
    await user.click(screen.getByRole('button', { name: 'Select line 1' }))
    await user.type(
      screen.getByLabelText('Review thread comment'),
      'What guarantees this path?',
    )
    await user.click(screen.getByRole('button', { name: /Start thread/ }))

    await waitFor(() => {
      expect(mockedCreateReviewThread).toHaveBeenCalledWith({
        anchorCommitSha: 'head-sha',
        anchorSnapshotId: 'snap-1',
        body: 'What guarantees this path?',
        excerpt: '1: b',
        filePath: 'src/a.ts',
        lineEnd: 1,
        lineStart: 1,
        number: 7,
        owner: 'ef-global',
        repo: 'backpack',
        side: 'new',
      })
    })
    expect(screen.getByText('What guarantees this path?')).toBeInTheDocument()
  })

  it('asks the agent automatically after creating a thread', async () => {
    const user = userEvent.setup()
    mockedCreateReviewThread.mockResolvedValue(
      makeReviewThread({ body: 'What guarantees this path?' }),
    )

    render(<ReviewWorkspace autoGenerate={false} workspace={makeWorkspace()} />)

    await user.click(screen.getByRole('button', { name: /Diff/ }))
    await user.click(screen.getByRole('button', { name: 'Select line 1' }))
    await user.type(
      screen.getByLabelText('Review thread comment'),
      'What guarantees this path?',
    )
    await user.click(screen.getByRole('button', { name: /Start thread/ }))

    await waitFor(() => {
      expect(mockedRequestReviewThreadAgentReply).toHaveBeenCalledWith(
        'thread-1',
      )
    })
    expect(
      await screen.findByText('It validates the token before use.'),
    ).toBeInTheDocument()
  })

  it('shows an errored agent comment when the agent request fails', async () => {
    const user = userEvent.setup()
    mockedCreateReviewThread.mockResolvedValue(
      makeReviewThread({ body: 'What guarantees this path?' }),
    )
    mockedRequestReviewThreadAgentReply.mockRejectedValue(
      new Error('The review agent session failed while answering.'),
    )

    render(<ReviewWorkspace autoGenerate={false} workspace={makeWorkspace()} />)

    await user.click(screen.getByRole('button', { name: /Diff/ }))
    await user.click(screen.getByRole('button', { name: 'Select line 1' }))
    await user.type(
      screen.getByLabelText('Review thread comment'),
      'What guarantees this path?',
    )
    await user.click(screen.getByRole('button', { name: /Start thread/ }))

    expect(
      await screen.findByText(
        'The review agent session failed while answering.',
      ),
    ).toBeInTheDocument()
  })
})

function makeAnsweredReviewThread(threadId: string): ReviewThread {
  const base = makeReviewThread({ body: 'What guarantees this path?' })

  return {
    ...base,
    comments: [
      ...base.comments,
      {
        agentState: 'complete',
        authorType: 'agent',
        authorUserId: null,
        body: 'It validates the token before use.',
        createdAt: '2026-06-12T10:00:10.000Z',
        id: 'comment-agent-1',
        threadId,
      },
    ],
  }
}

function makeReviewThread(input?: { body?: string }): ReviewThread {
  return {
    anchorCommitSha: 'head-sha',
    anchorSnapshotId: 'snap-1',
    comments: [
      {
        agentState: null,
        authorType: 'user',
        authorUserId: 'user-1',
        body: input?.body ?? 'Why did this change?',
        createdAt: '2026-06-12T10:00:00.000Z',
        id: 'comment-1',
        threadId: 'thread-1',
      },
    ],
    createdAt: '2026-06-12T10:00:00.000Z',
    createdByUserId: 'user-1',
    excerpt: '1: b',
    filePath: 'src/a.ts',
    id: 'thread-1',
    lineEnd: 1,
    lineStart: 1,
    owner: 'ef-global',
    pullRequestNumber: 7,
    repo: 'backpack',
    side: 'new',
    status: 'open',
    updatedAt: '2026-06-12T10:00:00.000Z',
  }
}
