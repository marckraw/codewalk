import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnimatedStatus } from '@/shared/ui/animated-status'

describe('AnimatedStatus', () => {
  it('renders the current status', () => {
    render(<AnimatedStatus status="thinking" />)
    expect(screen.getByText('thinking')).toBeInTheDocument()
  })

  it('swaps to the new status when it changes', () => {
    const { rerender, container } = render(<AnimatedStatus status="thinking" />)
    rerender(<AnimatedStatus status="writing the answer" />)
    // Keyed remount: exactly one status node, showing the latest value.
    expect(screen.getByText('writing the answer')).toBeInTheDocument()
    expect(container.querySelectorAll('.animate-status-roll-in')).toHaveLength(
      1,
    )
  })
})
