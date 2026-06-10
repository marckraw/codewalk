import Link from 'next/link'
import { ArrowUpRight, GitPullRequestArrow } from 'lucide-react'
import { CodeReviewGuideGenerationControl } from '@/features/code-review-guide-generation-control'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import type {
  ReviewWorkspaceState,
  ReviewWorkspaceSummary,
} from '@/entities/database'
import { PullRequestStatusBadge } from './pull-request-status-badge'
import {
  formatAbsoluteReviewDate,
  formatRelativeReviewTime,
} from './review-dashboard.pure'

const STATUS_TONE: Record<
  ReviewWorkspaceState,
  'success' | 'warning' | 'danger' | 'muted'
> = {
  failed: 'danger',
  imported: 'muted',
  preparing: 'warning',
  ready: 'success',
}

const STATUS_LABEL: Record<ReviewWorkspaceState, string> = {
  failed: 'Failed',
  imported: 'Imported',
  preparing: 'Preparing',
  ready: 'Ready',
}

export function ReviewWorkspaceRow({
  isLatest,
  item,
  now,
}: {
  isLatest?: boolean
  item: ReviewWorkspaceSummary
  now: Date | null
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <Link
        className="group flex min-w-0 flex-1 flex-col gap-1 outline-none"
        href={`/review/${encodeURIComponent(item.id)}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {isLatest ? <Badge tone="success">Latest</Badge> : null}
          <Badge tone={STATUS_TONE[item.status]}>
            {STATUS_LABEL[item.status]}
          </Badge>
          <PullRequestStatusBadge status={item.prStatus} />
          <span className="truncate font-mono text-xs text-[var(--muted)]">
            {item.owner}/{item.repo} #{item.number}
          </span>
        </div>
        <p className="truncate text-sm font-semibold group-hover:underline">
          {item.title}
        </p>
        <p className="truncate text-xs text-[var(--muted)]">
          {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'} ·{' '}
          {item.baseRef} → {item.headRef} · updated{' '}
          {now
            ? formatRelativeReviewTime(item.updatedAt, now)
            : formatAbsoluteReviewDate(item.updatedAt)}
        </p>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          asChild
          className="h-8 gap-1.5 px-2 text-xs"
          size="sm"
          variant="outline"
        >
          <a href={item.url} rel="noreferrer" target="_blank">
            <GitPullRequestArrow className="size-3.5" />
            PR
          </a>
        </Button>
        <CodeReviewGuideGenerationControl
          force
          label="Regenerate"
          snapshotId={item.id}
        />
        <Button
          asChild
          className="h-8 gap-1.5 px-2 text-xs"
          size="sm"
          variant="primary"
        >
          <Link href={`/review/${encodeURIComponent(item.id)}`}>
            Open
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
