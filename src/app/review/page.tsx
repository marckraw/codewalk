import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
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
        <div className="p-4 text-sm text-[var(--muted)]">
          Auth is wired. PR import and persisted workspace data land in the next tickets.
        </div>
      </Panel>
    </main>
  );
}
