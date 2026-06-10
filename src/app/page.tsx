import { OpenPullRequestDialog } from "@/features/pull-request-import";
import { ReviewDashboard } from "@/widgets/code-review-surface";
import { SiteHeader } from "@/widgets/site-header";
import { Badge } from "@/shared/ui/badge";
import { EmptyState } from "@/shared/ui/empty-state";
import { Panel, PanelHeader } from "@/shared/ui/panel";
import { getCurrentCodewalkUser } from "@/entities/auth-server";
import { listReviewWorkspaces } from "@/entities/database";

export default async function Home() {
  const user = await getCurrentCodewalkUser();
  const isAuthenticated = user.status === "authenticated";
  const workspaces = isAuthenticated ? await listReviewWorkspaces() : [];

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <section className="px-4 py-4 sm:px-6">
        {user.status === "misconfigured" ? (
          <Panel className="max-w-2xl">
            <PanelHeader
              actions={<Badge tone="warning">setup required</Badge>}
              description="GitHub sign-in is disabled until Clerk keys are configured."
              title="Clerk configuration missing"
            />
            <div className="grid gap-3 p-4 text-sm">
              <p className="text-[var(--muted)]">Add the missing keys to `.env.local`, then restart the development server.</p>
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
              description="Sign in with GitHub to import pull requests and open guided reviews."
              title="Codewalk reviews"
            />
            <div className="grid min-h-[calc(100vh-137px)] place-items-center p-4">
              <EmptyState
                className="w-full max-w-xl"
                description="Use the GitHub sign-in button to start a Codewalk review."
                title="Sign in required"
              />
            </div>
          </Panel>
        ) : (
          <Panel className="min-h-[calc(100vh-88px)]">
            <PanelHeader
              actions={
                <>
                  <Badge tone="muted">{workspaces.length} reviews</Badge>
                  <OpenPullRequestDialog />
                </>
              }
              description="Recent pull request snapshots and their guided review status."
              title="Codewalk reviews"
            />
            {workspaces.length === 0 ? (
              <div className="grid min-h-[calc(100vh-137px)] place-items-center p-4">
                <EmptyState
                  action={<OpenPullRequestDialog />}
                  className="w-full max-w-xl"
                  description="No pull request snapshot has been imported yet. Import a PR to create a review workspace, or open a ready review from a PR comment."
                  title="No reviews yet"
                />
              </div>
            ) : (
              <ReviewDashboard items={workspaces} />
            )}
          </Panel>
        )}
      </section>
    </main>
  );
}
