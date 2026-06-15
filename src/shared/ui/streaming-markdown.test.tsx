import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StreamingMarkdown } from '@/shared/ui/streaming-markdown'

describe('StreamingMarkdown', () => {
  it('renders nothing for empty content without loading the renderer', () => {
    const { container } = render(<StreamingMarkdown content="   " />)
    expect(container).toBeEmptyDOMElement()
  })
})
