import { ReviewSnapshotPageShell } from './page-shell'

// Five placeholder rows for the guide rail while the workspace loads.
const RAIL_ROWS = ['r1', 'r2', 'r3', 'r4', 'r5']

/**
 * Instant skeleton for the review page. The review route is dynamic (auth + DB +
 * daemon reconcile), so navigation can't prerender — without this fallback a
 * click sits on a blank screen. Mirrors the real workspace layout (top bar +
 * 320px rail + content) so the swap to the live UI is seamless.
 */
export default function Loading() {
  return (
    <ReviewSnapshotPageShell>
      <section className="flex h-[calc(100vh-57px)] min-h-[680px] flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="size-4 shrink-0 animate-pulse rounded bg-[var(--panel-subtle)]" />
            <div className="grid gap-1.5">
              <div className="h-3.5 w-48 animate-pulse rounded bg-[var(--panel-subtle)]" />
              <div className="h-3 w-72 animate-pulse rounded bg-[var(--panel-subtle)]" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-7 w-24 animate-pulse rounded-md bg-[var(--panel-subtle)]" />
            <div className="h-8 w-28 animate-pulse rounded-md bg-[var(--panel-subtle)]" />
          </div>
        </div>

        <div className="relative grid min-h-0 flex-1 grid-rows-[minmax(180px,280px)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
          <div className="border-b border-border p-3 lg:border-r lg:border-b-0">
            <div className="grid gap-2">
              {RAIL_ROWS.map((row) => (
                <div
                  className="h-14 animate-pulse rounded-md bg-[var(--panel-subtle)]"
                  key={row}
                />
              ))}
            </div>
          </div>
          <div className="p-4">
            <div className="grid gap-3">
              <div className="h-5 w-1/3 animate-pulse rounded bg-[var(--panel-subtle)]" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--panel-subtle)]" />
              <div className="mt-2 h-64 animate-pulse rounded-lg bg-[var(--panel-subtle)]" />
            </div>
          </div>
        </div>
      </section>
    </ReviewSnapshotPageShell>
  )
}
