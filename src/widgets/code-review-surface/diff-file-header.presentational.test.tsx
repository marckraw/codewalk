import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DiffFileHeader } from './diff-file-header.presentational'

describe('DiffFileHeader', () => {
  it('renders guide-style file metadata with a description subtitle', () => {
    render(
      <DiffFileHeader
        path="src/a.ts"
        status="modified"
        subtitle="Review the changed behavior."
        subtitleVariant="description"
      />,
    )

    expect(screen.getByText('src/a.ts')).toBeInTheDocument()
    expect(screen.getByText('modified')).toBeInTheDocument()
    expect(screen.getByText('Review the changed behavior.')).toHaveClass(
      'text-xs',
    )
  })

  it('renders the default diff label subtitle', () => {
    render(<DiffFileHeader path="src/a.ts" subtitle="Pull request diff" />)

    expect(screen.getByText('Pull request diff')).toHaveClass('uppercase')
  })
})
