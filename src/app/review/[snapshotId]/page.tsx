import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AuthControls } from "@/components/auth/auth-controls";
import { ReviewWorkspace } from "@/components/review/review-workspace";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Toolbar } from "@/components/ui/toolbar";
import { parseReviewDeepLink } from "@/components/review/review-deep-link.pure";
import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { getReviewWorkspace } from "@/lib/db/review-workspace";
import { APP_NAME } from "@/lib/product";

type ReviewSnapshotSearchParams = {
  file?: string | string[];
  generate?: string;
  section?: string | string[];
  view?: string | string[];
};

type ReviewSnapshotPageProps = {
  params: Promise<{
    snapshotId: string;
  }>;
  searchParams?: Promise<ReviewSnapshotSearchParams>;
};

export default async function ReviewSnapshotPage({ params, searchParams }: ReviewSnapshotPageProps) {
  const [{ snapshotId }, query, user] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as ReviewSnapshotSearchParams),
    getCurrentCodewalkUser(),
  ]);

  if (user.status === "misconfigured") {
    return (
      <Shell>
        <Panel className="mx-4 mt-4 max-w-2xl sm:mx-6">
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
      </Shell>
    );
  }

  if (user.status === "signed-out") {
    return (
      <Shell>
        <Panel className="mx-4 mt-4 max-w-2xl sm:mx-6">
          <PanelHeader
            actions={<Badge tone="warning">auth required</Badge>}
            description="Sign in with GitHub to open this guided review."
            title="Protected review"
          />
        </Panel>
      </Shell>
    );
  }

  const workspace = await getReviewWorkspace(snapshotId);

  if (!workspace) {
    notFound();
  }

  return (
    <Shell>
      <ReviewWorkspace
        autoGenerate={query.generate === "1"}
        deepLink={parseReviewDeepLink(query)}
        workspace={workspace}
      />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen">
      <Toolbar>
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] text-sm font-semibold">
            C
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{APP_NAME}</h1>
            <p className="truncate text-xs text-[var(--muted)]">Guided pull request review</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeModeToggle />
          <AuthControls />
        </div>
      </Toolbar>
      {children}
    </main>
  );
}
