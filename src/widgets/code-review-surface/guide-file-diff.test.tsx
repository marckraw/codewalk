import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GuideFileDiff } from './guide-file-diff'

vi.mock('./pierre-diff-viewer', () => ({
  PierreDiffViewer: ({
    file,
    status,
    subtitle,
  }: {
    file: string | null
    status?: string | null
    subtitle?: string
  }) => (
    <div data-testid="embedded-diff">
      {file ? <div>{file}</div> : null}
      {status ? <div>{status}</div> : null}
      {subtitle ? <div>{subtitle}</div> : null}
    </div>
  ),
}))

describe('GuideFileDiff', () => {
  it('renders guide metadata through the shared diff header', () => {
    render(
      <GuideFileDiff
        diff="@@ -1 +1 @@\n-old\n+new"
        file={{
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          guideSectionId: 'section-1',
          hunkHints: [],
          id: 'guide-file-1',
          order: 0,
          path: 'src/a.ts',
          reason: 'Review the changed behavior.',
          status: 'modified',
        }}
        loading={false}
        renderRef={() => undefined}
      />,
    )

    expect(screen.getAllByText('src/a.ts')).toHaveLength(1)
    expect(screen.getByTestId('embedded-diff')).toHaveTextContent('modified')
    expect(screen.getByTestId('embedded-diff')).toHaveTextContent(
      'Review the changed behavior.',
    )
  })
})
