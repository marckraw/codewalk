import { DaemonStatus } from '@/widgets/daemon-status'
import { SiteHeader } from '@/widgets/site-header'
import { Badge } from '@/shared/ui/badge'
import { EmptyState } from '@/shared/ui/empty-state'
import { Panel, PanelHeader } from '@/shared/ui/panel'
import { getCurrentCodewalkUser } from '@/entities/auth-server'

export default async function StatusPage() {
  const user = await getCurrentCodewalkUser()
  const isAuthenticated = user.status === 'authenticated'

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <section className="px-4 py-4 sm:px-6">
        {user.status === 'misconfigured' ? (
          <Panel className="max-w-2xl">
            <PanelHeader
              actions={<Badge tone="warning">setup required</Badge>}
              description="Daemon status is protected by the same Clerk gate as the rest of Codewalk."
              title="Clerk configuration missing"
            />
            <div className="grid gap-3 p-4 text-sm">
              <p className="text-[var(--muted)]">
                Add the missing keys to `.env.local`, then restart the
                development server.
              </p>
              <ul className="list-inside list-disc font-mono text-xs text-[var(--foreground)]">
                {user.missingKeys.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          </Panel>
        ) : !isAuthenticated ? (
          <Panel className="min-h-[calc(100vh-88px)]">
            <PanelHeader
              actions={<Badge tone="warning">auth required</Badge>}
              description="Sign in with GitHub to inspect agents-daemon runtime status."
              title="Daemon status"
            />
            <div className="grid min-h-[calc(100vh-137px)] place-items-center p-4">
              <EmptyState
                className="w-full max-w-xl"
                description="Use the GitHub sign-in button to inspect the guided review backend."
                title="Sign in required"
              />
            </div>
          </Panel>
        ) : (
          <Panel className="min-h-[calc(100vh-88px)]">
            <PanelHeader
              actions={<Badge tone="muted">live daemon</Badge>}
              description="Current agents-daemon runtime, provider auth, installed CLI versions, and reported model list."
              title="Daemon status"
            />
            <DaemonStatus />
          </Panel>
        )}
      </section>
    </main>
  )
}
