import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnimatedStatus } from '@/shared/ui/animated-status'

describe('AnimatedStatus', () => {
  it('renders the current status', () => {
    render(<AnimatedStatus status="thinking" />)
    expect(screen.getByText('thinking')).toBeInTheDocument()
  })

  it('shows the new status when it changes', () => {
    const { rerender } = render(<AnimatedStatus status="thinking" />)
    rerender(<AnimatedStatus status="writing the answer" />)
    // The incoming status renders; AnimatePresence animates the old one out.
    expect(screen.getByText('writing the answer')).toBeInTheDocument()
  })
})
