import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnimatedStatusContent } from '@/shared/ui/animated-status-content'

describe('AnimatedStatusContent', () => {
  it('renders the current status', () => {
    render(<AnimatedStatusContent status="thinking" />)
    expect(screen.getByText('thinking')).toBeInTheDocument()
  })

  it('shows the new status when it changes', () => {
    const { rerender } = render(<AnimatedStatusContent status="thinking" />)
    rerender(<AnimatedStatusContent status="writing the answer" />)
    // The incoming status renders; AnimatePresence animates the old one out.
    expect(screen.getByText('writing the answer')).toBeInTheDocument()
  })
})
