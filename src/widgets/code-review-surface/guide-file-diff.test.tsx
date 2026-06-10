import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GuideFileDiff } from './guide-file-diff'

vi.mock('./pierre-diff-viewer', () => ({
  PierreDiffViewer: ({
    file,
    showHeader = true,
  }: {
    file: string | null
    showHeader?: boolean
  }) => (
    <div data-testid="embedded-diff">
      {showHeader && file ? <div>{file}</div> : null}
    </div>
  ),
}))

describe('GuideFileDiff', () => {
  it('uses the guide card header as the only file header', () => {
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
    expect(screen.getByTestId('embedded-diff')).not.toHaveTextContent(
      'src/a.ts',
    )
  })
})
