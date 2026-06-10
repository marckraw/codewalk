import { notFound, redirect } from 'next/navigation'
import { ReviewWorkspace } from '@/widgets/code-review-surface'
import { Badge } from '@/shared/ui/badge'
import { Panel, PanelHeader } from '@/shared/ui/panel'
import { parseReviewDeepLink } from '@/widgets/code-review-surface'
import { getCurrentCodewalkUser } from '@/entities/auth-server'
import {
  getLatestPullRequestSnapshotByRef,
  getReviewWorkspace,
} from '@/entities/database'
import { parseGitHubPullRequestUrl } from '@/entities/github'
import { ReviewSnapshotPageShell } from '../page-shell'

type ReviewSnapshotSearchParams = Record<
  string,
  string | string[] | undefined
> & {
  file?: string | string[]
  generate?: string | string[]
  section?: string | string[]
  view?: string | string[]
}

type ReviewSnapshotPageProps = {
  params: Promise<{
    reviewAlias?: string[]
    snapshotId: string
  }>
  searchParams?: Promise<ReviewSnapshotSearchParams>
}

export default async function ReviewSnapshotPage({
  params,
  searchParams,
}: ReviewSnapshotPageProps) {
  const [routeParams, query, user] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as ReviewSnapshotSearchParams),
    getCurrentCodewalkUser(),
  ])

  if (user.status === 'misconfigured') {
    return (
      <ReviewSnapshotPageShell>
        <Panel className="mx-4 mt-4 max-w-2xl sm:mx-6">
          <PanelHeader
            actions={<Badge tone="warning">setup required</Badge>}
            description="GitHub sign-in is disabled until Clerk keys are configured."
            title="Clerk configuration missing"
          />
          <div className="grid gap-3 p-4 text-sm">
            <p className="text-[var(--muted)]">
              Add the missing keys to `.env.local`, then restart the development
              server.
            </p>
            <ul className="list-inside list-disc font-mono text-xs text-[var(--foreground)]">
              {user.missingKeys.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </div>
        </Panel>
      </ReviewSnapshotPageShell>
    )
  }

  if (user.status === 'signed-out') {
    return (
      <ReviewSnapshotPageShell>
        <Panel className="mx-4 mt-4 max-w-2xl sm:mx-6">
          <PanelHeader
            actions={<Badge tone="warning">auth required</Badge>}
            description="Sign in with GitHub to open this guided review."
            title="Protected review"
          />
        </Panel>
      </ReviewSnapshotPageShell>
    )
  }

  if (routeParams.reviewAlias && routeParams.reviewAlias.length > 0) {
    const snapshotId = await resolvePullRequestAliasSnapshotId(routeParams)
    redirect(
      buildReviewPullRequestAliasRedirectPath({
        searchParams: query,
        snapshotId,
      }),
    )
  }

  const { snapshotId } = routeParams
  const workspace = await getReviewWorkspace(snapshotId)

  if (!workspace) {
    notFound()
  }

  return (
    <ReviewSnapshotPageShell>
      <ReviewWorkspace
        autoGenerate={query.generate === '1'}
        deepLink={parseReviewDeepLink(query)}
        workspace={workspace}
      />
    </ReviewSnapshotPageShell>
  )
}

async function resolvePullRequestAliasSnapshotId(input: {
  reviewAlias?: string[]
  snapshotId: string
}) {
  const [repo, pullSegment, number, ...rest] = input.reviewAlias ?? []

  if (!repo || pullSegment !== 'pull' || !number || rest.length > 0) {
    notFound()
  }

  const parsed = parseGitHubPullRequestUrl(
    `https://github.com/${encodeURIComponent(input.snapshotId)}/${encodeURIComponent(repo)}/pull/${number}`,
  )

  if (!parsed.ok) {
    notFound()
  }

  const snapshot = await getLatestPullRequestSnapshotByRef(parsed.pullRequest)

  if (!snapshot) {
    notFound()
  }

  return snapshot.id
}

export function buildReviewPullRequestAliasRedirectPath(input: {
  searchParams: ReviewSnapshotSearchParams
  snapshotId: string
}) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(input.searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item)
      }
      continue
    }

    if (value !== undefined) {
      params.set(key, value)
    }
  }

  if (!params.has('view')) {
    params.set('view', 'guide')
  }

  return `/review/${encodeURIComponent(input.snapshotId)}?${params.toString()}`
}
