import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { OpenPullRequestDialog } from "@/components/open-pull-request-dialog";
import { getCurrentCodewalkUser } from "@/lib/auth/server";

export default async function ReviewPage() {
  const user = await getCurrentCodewalkUser();

  if (user.status === "misconfigured") {
    return (
      <main className="min-h-screen p-4 sm:p-6">
        <Panel className="max-w-2xl">
          <PanelHeader
            actions={<Badge tone="warning">setup required</Badge>}
            description="GitHub sign-in is disabled until Clerk keys are configured."
            title="Clerk configuration missing"
          />
          <div className="grid gap-3 p-4 text-sm">
            <p className="text-[var(--muted)]">
              Add the missing keys to `.env.local`, then restart the development server.
            </p>
            <ul className="list-inside list-disc font-mono text-xs text-[var(--foreground)]">
              {user.missingKeys.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </div>
        </Panel>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <Panel>
        <PanelHeader
          actions={<Badge tone="success">authenticated</Badge>}
          description={user.status === "authenticated" ? user.email ?? user.userId : "Protected route"}
          title="Codewalk review workspace"
        />
        <div className="grid min-h-[calc(100vh-137px)] place-items-center p-4">
          <EmptyState
            action={<OpenPullRequestDialog />}
            className="w-full max-w-xl"
            description="No pull request snapshot is loaded yet. Import a PR to create a review workspace, or open a ready review from a PR comment."
            title="No review loaded"
          />
        </div>
      </Panel>
    </main>
  );
}
