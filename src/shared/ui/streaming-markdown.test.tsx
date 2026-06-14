import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StreamingMarkdown } from '@/shared/ui/streaming-markdown'

describe('StreamingMarkdown', () => {
  it('renders markdown content', () => {
    render(<StreamingMarkdown content="Hello **world**" />)
    expect(screen.getByText(/world/)).toBeInTheDocument()
  })

  it('renders nothing for empty content', () => {
    const { container } = render(<StreamingMarkdown content="   " />)
    expect(container).toBeEmptyDOMElement()
  })
})
