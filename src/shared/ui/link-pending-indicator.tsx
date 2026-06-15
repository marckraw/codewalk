'use client'

import { useLinkStatus } from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/cn.pure'

/**
 * Inline pending spinner for a Next `<Link>`. Render it as a child of the
 * `<Link>` and it lights up while that navigation is in flight — the "your
 * click registered" confirmation for dynamic routes that can't prefetch.
 *
 * Debounced in pure CSS: it mounts invisible (`@starting-style` opacity 0) and
 * fades in only after a 150ms delay, so fast (prefetched) transitions complete
 * and unmount it before it ever shows. No JS timers, no effects.
 */
export function LinkPendingIndicator({ className }: { className?: string }) {
  const { pending } = useLinkStatus()

  if (!pending) {
    return null
  }

  return (
    <Loader2
      aria-hidden="true"
      className={cn(
        'size-3.5 shrink-0 animate-spin text-[var(--muted)] opacity-100 transition-opacity delay-150 duration-150 starting:opacity-0',
        className,
      )}
    />
  )
}
