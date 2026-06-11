import { getAgentsDaemonStatus } from '@/entities/agents-daemon'
import { cn } from '@/shared/lib/cn.pure'
import { Badge } from '@/shared/ui/badge'
import { EmptyState } from '@/shared/ui/empty-state'

export async function DaemonStatus() {
  const status = await getAgentsDaemonStatus()
  const meta = status.meta

  if (!status.ok || !meta) {
    return (
      <div className="p-4">
        <EmptyState
          description={status.message}
          title={statusLabel(status.state)}
        />
      </div>
    )
  }

  return (
    <div className="grid gap-4 p-4">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
          <dt className="text-xs text-[var(--muted)]">Daemon</dt>
          <dd className="mt-1 truncate text-sm font-semibold">{meta.name}</dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {meta.version} / {meta.apiVersion}
          </dd>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
          <dt className="text-xs text-[var(--muted)]">Uptime</dt>
          <dd className="mt-1 text-sm font-semibold">
            {formatDuration(meta.runtime.uptimeSeconds)}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {meta.runtime.host}:{meta.runtime.port}
          </dd>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
          <dt className="text-xs text-[var(--muted)]">Sessions</dt>
          <dd className="mt-1 text-sm font-semibold">
            {meta.runtime.activeSessions} / {meta.runtime.maxConcurrentAgents}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">active / maximum</dd>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
          <dt className="text-xs text-[var(--muted)]">GitHub</dt>
          <dd className="mt-1">
            <Badge tone={meta.git.githubAuthenticated ? 'success' : 'warning'}>
              {meta.git.githubAuthenticated ? 'authenticated' : 'missing auth'}
            </Badge>
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            shared VPS daemon
          </dd>
        </div>
      </dl>

      <div className="overflow-hidden rounded-md border border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-[var(--panel-subtle)] text-xs text-[var(--muted)]">
              <tr>
                <th className="border-b border-[var(--border)] px-3 py-2 font-medium">
                  Provider
                </th>
                <th className="border-b border-[var(--border)] px-3 py-2 font-medium">
                  Available
                </th>
                <th className="border-b border-[var(--border)] px-3 py-2 font-medium">
                  Auth
                </th>
                <th className="border-b border-[var(--border)] px-3 py-2 font-medium">
                  CLI version
                </th>
                <th className="border-b border-[var(--border)] px-3 py-2 font-medium">
                  Models
                </th>
              </tr>
            </thead>
            <tbody>
              {meta.providers.map((provider) => (
                <tr
                  className="border-b border-[var(--border)] last:border-b-0"
                  key={provider.id}
                >
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium">{provider.label}</div>
                    <div className="mt-1 max-w-64 text-xs text-[var(--muted)]">
                      {provider.details}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <Badge tone={provider.available ? 'success' : 'danger'}>
                      {provider.available ? 'yes' : 'no'}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <Badge
                      tone={provider.authenticated ? 'success' : 'warning'}
                    >
                      {provider.authenticated ? 'ready' : 'missing'}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs">
                    {provider.cliVersion ?? 'unknown'}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex max-w-xl flex-wrap gap-1">
                      {provider.models.length > 0 ? (
                        provider.models.map((model) => (
                          <Badge
                            className={cn(
                              model.slug === 'gpt-5.5'
                                ? 'border-[var(--accent)]'
                                : '',
                            )}
                            key={`${provider.id}:${model.slug}`}
                            tone={
                              model.slug === 'gpt-5.5' ? 'success' : 'muted'
                            }
                          >
                            {model.slug}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--muted)]">
                          none reported
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`

  return `${seconds}s`
}

function statusLabel(state: string) {
  if (state === 'missing-base-url' || state === 'missing-token') {
    return 'Daemon configuration missing'
  }

  if (state === 'unreachable') {
    return 'Daemon unreachable'
  }

  if (state === 'invalid-response') {
    return 'Daemon response invalid'
  }

  return 'Daemon status unavailable'
}
