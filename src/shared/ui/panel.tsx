import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn.pure'

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'aside' | 'div' | 'section'
}

export function Panel({
  as: Component = 'section',
  className,
  ...props
}: PanelProps) {
  return (
    <Component
      className={cn(
        'rounded-md border border-[var(--border)] bg-[var(--panel)]',
        className,
      )}
      {...props}
    />
  )
}

type PanelHeaderProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode
  description?: string
  title: string
}

export function PanelHeader({
  actions,
  className,
  description,
  title,
  ...props
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex min-h-12 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-xs text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
