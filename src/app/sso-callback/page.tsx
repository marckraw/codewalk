import { SsoCallback } from "@/components/auth/sso-callback";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getMissingClerkEnvironmentKeys, isClerkServerConfigured } from "@/lib/auth/server-config";

export default function SsoCallbackPage() {
  if (!isClerkServerConfigured()) {
    return (
      <main className="min-h-screen p-4 sm:p-6">
        <Panel className="max-w-2xl">
          <PanelHeader
            description="OAuth callback handling is disabled until Clerk keys are configured."
            title="Clerk configuration missing"
          />
          <div className="grid gap-3 p-4 text-sm">
            <p className="text-[var(--muted)]">
              Add the missing keys to `.env.local`, then restart the development server.
            </p>
            <ul className="list-inside list-disc font-mono text-xs text-[var(--foreground)]">
              {getMissingClerkEnvironmentKeys().map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </div>
        </Panel>
      </main>
    );
  }

  return <SsoCallback />;
}
