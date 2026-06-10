import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PierreDiffErrorBoundary } from './pierre-diff-error-boundary'

function Boom(): never {
  throw new Error('pierre exploded')
}

describe('PierreDiffErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when they do not throw', () => {
    render(
      <PierreDiffErrorBoundary fallback={<span>fallback</span>}>
        <span>diff content</span>
      </PierreDiffErrorBoundary>,
    )

    expect(screen.getByText('diff content')).toBeInTheDocument()
    expect(screen.queryByText('fallback')).not.toBeInTheDocument()
  })

  it('shows the fallback when a child throws during render', () => {
    render(
      <PierreDiffErrorBoundary fallback={<span>raw patch fallback</span>}>
        <Boom />
      </PierreDiffErrorBoundary>,
    )

    expect(screen.getByText('raw patch fallback')).toBeInTheDocument()
  })
})
