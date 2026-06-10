import { notFound } from "next/navigation";
import { ReviewWorkspace } from "@/widgets/code-review-surface";
import { Badge } from "@/shared/ui/badge";
import { Panel, PanelHeader } from "@/shared/ui/panel";
import { parseReviewDeepLink } from "@/widgets/code-review-surface";
import { getCurrentCodewalkUser } from "@/entities/auth-server";
import { getReviewWorkspace } from "@/entities/database";
import { ReviewSnapshotPageShell } from "./page-shell";

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
      <ReviewSnapshotPageShell>
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
      </ReviewSnapshotPageShell>
    );
  }

  if (user.status === "signed-out") {
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
    );
  }

  const workspace = await getReviewWorkspace(snapshotId);

  if (!workspace) {
    notFound();
  }

  return (
    <ReviewSnapshotPageShell>
      <ReviewWorkspace
        autoGenerate={query.generate === "1"}
        deepLink={parseReviewDeepLink(query)}
        workspace={workspace}
      />
    </ReviewSnapshotPageShell>
  );
}
