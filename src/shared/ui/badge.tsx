import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn.pure'

type BadgeTone =
  | 'default'
  | 'muted'
  | 'success'
  | 'warning'
  | 'danger'
  | 'merged'

const toneClassName: Record<BadgeTone, string> = {
  default: 'text-[var(--foreground)]',
  muted: 'text-[var(--muted)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  danger: 'text-[var(--danger)]',
  merged: 'text-[var(--merged)]',
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

export function Badge({ className, tone = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-sm border border-[var(--border)] bg-[var(--panel)] px-2 text-xs font-medium',
        toneClassName[tone],
        className,
      )}
      {...props}
    />
  )
}
