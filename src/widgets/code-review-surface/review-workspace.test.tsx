import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReviewWorkspace as ReviewWorkspaceModel } from './review-types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))

// Stub the heavy Pierre-backed leaves so we exercise the orchestration only.
vi.mock('./pierre-diff-viewer', () => ({
  PierreDiffViewer: ({ file }: { file: string | null }) => (
    <div data-testid="diff-pane">{file ?? 'no-file'}</div>
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
})
