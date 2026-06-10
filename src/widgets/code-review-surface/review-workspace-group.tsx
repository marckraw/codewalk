import { ChevronDown } from 'lucide-react'
import type { ReviewWorkspacePullRequestGroup } from './review-dashboard.pure'
import { ReviewWorkspaceRow } from './review-workspace-row'

export function ReviewWorkspaceGroup({
  group,
  now,
}: {
  group: ReviewWorkspacePullRequestGroup
  now: Date | null
}) {
  const previousCount = group.previous.length

  return (
    <li className="grid gap-2">
      <ReviewWorkspaceRow
        isLatest={previousCount > 0}
        item={group.latest}
        now={now}
      />

      {previousCount > 0 ? (
        <details className="group/details ml-3 grid gap-2 border-l border-[var(--border)] pl-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-[var(--muted)] marker:hidden">
            <ChevronDown className="size-3.5 transition-transform group-open/details:rotate-180" />
            {previousCount} earlier {previousCount === 1 ? 'run' : 'runs'}
          </summary>
          <ul className="mt-2 grid gap-2">
            {group.previous.map((item) => (
              <li key={item.id}>
                <ReviewWorkspaceRow item={item} now={now} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  )
}
