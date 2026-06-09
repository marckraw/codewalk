import { AuthControls } from "@/components/auth/auth-controls";
import { OpenPullRequestDialog } from "@/components/open-pull-request-dialog";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Toolbar } from "@/components/ui/toolbar";
import { APP_NAME } from "@/lib/product";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header>
        <Toolbar>
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] text-sm font-semibold">
              C
            </div>
            <div>
              <h1 className="text-sm font-semibold">{APP_NAME}</h1>
              <p className="text-xs text-[var(--muted)]">Guided pull request review</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OpenPullRequestDialog />
            <ThemeModeToggle />
            <AuthControls />
          </div>
        </Toolbar>
      </header>

      <section className="px-4 py-4 sm:px-6">
        <Panel className="min-h-[calc(100vh-88px)]">
          <PanelHeader
            description="Import a GitHub pull request or open a guided review link."
            title="Review workspace"
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
      </section>
    </main>
  );
}
