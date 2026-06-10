import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type DiffFileHeaderSubtitleVariant = 'description' | 'label'

interface DiffFileHeaderProps {
  actions?: ReactNode
  loading?: boolean
  path: string
  status?: string | null
  subtitle?: string
  subtitleVariant?: DiffFileHeaderSubtitleVariant
}

export function DiffFileHeader({
  actions = null,
  loading = false,
  path,
  status = null,
  subtitle,
  subtitleVariant = 'label',
}: DiffFileHeaderProps) {
  return (
    <div className="shrink-0 border-b border-border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {status ? (
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {status}
          </span>
        ) : null}
        <p
          className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
          title={path}
        >
          {path}
        </p>
        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
        {actions}
      </div>
      {subtitle ? (
        <p
          className={
            subtitleVariant === 'description'
              ? 'mt-1 text-xs leading-5 text-muted-foreground'
              : 'mt-1 text-[10px] text-muted-foreground uppercase tracking-wider'
          }
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}
