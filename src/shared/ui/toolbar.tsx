import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn.pure'

export function Toolbar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex min-h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2 sm:px-6',
        className,
      )}
      {...props}
    />
  )
}
