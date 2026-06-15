import { SiteHeader } from '@/widgets/site-header'

/**
 * App-wide navigation fallback for segments without a tailored skeleton
 * (dashboard, settings, status). Keeps the header in place and shows a panel
 * placeholder so a click registers instantly instead of hanging on a blank
 * screen while the dynamic, auth-gated route renders.
 */
export default function Loading() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <section className="px-4 py-4 sm:px-6">
        <div className="min-h-[calc(100vh-88px)] animate-pulse rounded-lg border border-[var(--border)] bg-[var(--panel-subtle)]" />
      </section>
    </main>
  )
}
