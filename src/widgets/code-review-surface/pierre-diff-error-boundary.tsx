'use client'

import { Component, type ReactNode } from 'react'

interface PierreDiffErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface PierreDiffErrorBoundaryState {
  hasError: boolean
}

/**
 * Isolates the third-party Pierre diff renderer so a render/highlighter/worker
 * failure degrades to a raw-patch fallback instead of crashing the whole
 * review workspace.
 */
export class PierreDiffErrorBoundary extends Component<
  PierreDiffErrorBoundaryProps,
  PierreDiffErrorBoundaryState
> {
  state: PierreDiffErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): PierreDiffErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    if (typeof console !== 'undefined') {
      console.error('[codewalk-pierre-diff-render-failed]', error)
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}
