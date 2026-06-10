import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownText } from './markdown'

describe('MarkdownText', () => {
  it('renders nothing for blank content', () => {
    const { container } = render(<MarkdownText content="   " />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders bullet lists, inline code, and emphasis', () => {
    const { container } = render(
      <MarkdownText content={'- first item\n- uses `code`\n- is **bold**'} />,
    )

    expect(container.querySelectorAll('li')).toHaveLength(3)
    expect(container.querySelector('code')?.textContent).toBe('code')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  it('renders links that open safely in a new tab', () => {
    render(
      <MarkdownText content="see [the PR](https://github.com/ef-global/backpack/pull/1)" />,
    )

    const link = screen.getByRole('link', { name: 'the PR' })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/ef-global/backpack/pull/1',
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('does not render raw HTML', () => {
    const { container } = render(
      <MarkdownText content={"<button id='danger'>click</button> safe text"} />,
    )

    expect(container.querySelector('#danger')).toBeNull()
    expect(container.textContent).toContain('safe text')
  })
})
