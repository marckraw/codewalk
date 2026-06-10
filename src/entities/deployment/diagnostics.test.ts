import { describe, expect, it, vi } from 'vitest'
import { getDeploymentDiagnostics } from './diagnostics'

vi.mock('server-only', () => ({}))

describe('getDeploymentDiagnostics', () => {
  it('reports deployment readiness without exposing secrets', () => {
    const diagnostics = getDeploymentDiagnostics({
      AGENTS_DAEMON_API_TOKEN: 'daemon-secret',
      AGENTS_DAEMON_BASE_URL: 'https://daemon.example.com/',
      AGENTS_DAEMON_REQUEST_TIMEOUT_MS: '60000',
      CLERK_SECRET_KEY: 'clerk-secret',
      DATABASE_URL: 'postgres://secret@example.com/db',
      DEFAULT_GUIDE_MODEL: 'gpt-5.4',
      DEFAULT_GUIDE_PROVIDER: 'codex',
      GITHUB_ALLOWED_OWNER: 'ef-global',
      GITHUB_BOT_TOKEN: 'github-secret',
      GITHUB_REQUEST_TIMEOUT_MS: '15000',
      GITHUB_WEBHOOK_SECRET: 'webhook-secret',
      NEXT_PUBLIC_APP_URL: 'https://codewalk.example.com/path?debug=1',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_public',
      NODE_ENV: 'test',
      VERCEL_ENV: 'preview',
    })

    expect(diagnostics).toMatchObject({
      agentsDaemon: {
        baseUrl: 'https://daemon.example.com',
        ok: true,
      },
      app: {
        baseUrl: 'https://codewalk.example.com/path',
        ok: true,
      },
      auth: {
        ok: true,
      },
      database: {
        ok: true,
      },
      github: {
        allowedOwner: 'ef-global',
        ok: true,
      },
      ok: true,
      runtime: {
        agentsDaemonRequestTimeoutMs: 60000,
        githubRequestTimeoutMs: 15000,
      },
    })
    expect(JSON.stringify(diagnostics)).not.toContain('secret')
    expect(JSON.stringify(diagnostics)).not.toContain('postgres://')
  })

  it('reports missing deployment configuration', () => {
    expect(getDeploymentDiagnostics({})).toMatchObject({
      agentsDaemon: {
        missingKeys: ['AGENTS_DAEMON_BASE_URL'],
        ok: false,
      },
      app: {
        state: 'missing-url',
      },
      auth: {
        missingKeys: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
        ok: false,
      },
      database: {
        missingKeys: ['DATABASE_URL'],
        ok: false,
      },
      github: {
        missingKeys: [
          'GITHUB_WEBHOOK_SECRET',
          'GITHUB_BOT_TOKEN',
          'GITHUB_ALLOWED_OWNER',
        ],
        ok: false,
      },
      ok: false,
    })
  })
})
