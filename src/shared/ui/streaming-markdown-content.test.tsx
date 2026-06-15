import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StreamingMarkdownContent } from '@/shared/ui/streaming-markdown-content'

describe('StreamingMarkdownContent', () => {
  it('renders markdown content', () => {
    render(<StreamingMarkdownContent content="Hello **world**" />)
    expect(screen.getByText(/world/)).toBeInTheDocument()
  })
})
