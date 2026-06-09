import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AuthControls } from "@/components/auth/auth-controls";
import { CodeReviewGuideGenerationControl } from "@/components/code-review-guide-generation-control";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Toolbar } from "@/components/ui/toolbar";
import { getCurrentCodewalkUser } from "@/lib/auth/server";
import { getReviewWorkspace, type ReviewWorkspaceData } from "@/lib/db/review-workspace";
import { APP_NAME } from "@/lib/product";
import { AlertTriangle, CheckCircle2, Clock3, FileCode2, GitPullRequestArrow, ListChecks } from "lucide-react";

type ReviewSnapshotPageProps = {
  params: Promise<{
    snapshotId: string;
  }>;
  searchParams?: Promise<{
    generate?: string;
  }>;
};

export default async function ReviewSnapshotPage({ params, searchParams }: ReviewSnapshotPageProps) {
  const [{ snapshotId }, query, user] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { generate?: string }),
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
      <ReviewWorkspace autoGenerate={query.generate === "1"} workspace={workspace} />
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

function ReviewWorkspace({ autoGenerate, workspace }: { autoGenerate: boolean; workspace: ReviewWorkspaceData }) {
  const selectedFile = workspace.files[0] ?? null;

  return (
    <section className="grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Panel as="aside" className="min-h-[calc(100vh-88px)]">
        <PanelHeader
          actions={<WorkspaceStatusBadge workspace={workspace} />}
          description={`${workspace.snapshot.owner}/${workspace.snapshot.repo} #${workspace.snapshot.number}`}
          title={workspace.snapshot.title}
        />
        <div className="grid gap-3 p-3">
          <SnapshotSummary workspace={workspace} />
          <GuideRail autoGenerate={autoGenerate} workspace={workspace} />
        </div>
      </Panel>

      <Panel className="min-h-[calc(100vh-88px)]">
        <PanelHeader
          actions={
            <>
              <Badge tone="success">{workspace.files.length} files</Badge>
              {workspace.guide ? <Badge tone="warning">{workspace.guide.sections.length} sections</Badge> : null}
            </>
          }
          description={`${workspace.snapshot.baseRef} -> ${workspace.snapshot.headRef}`}
          title="Review workspace"
        />

        <div className="grid min-h-[calc(100vh-137px)] lg:grid-cols-[300px_1fr]">
          <ChangedFiles files={workspace.files} selectedPath={selectedFile?.path ?? null} />
          <DiffPreview file={selectedFile} />
        </div>
      </Panel>
    </section>
  );
}

function SnapshotSummary({ workspace }: { workspace: ReviewWorkspaceData }) {
  return (
    <div className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] p-3 text-xs">
      <div className="flex items-center gap-2 font-semibold">
        <GitPullRequestArrow aria-hidden="true" className="size-3.5" />
        <a className="truncate text-[var(--accent)]" href={workspace.snapshot.url} rel="noreferrer" target="_blank">
          {workspace.snapshot.owner}/{workspace.snapshot.repo}#{workspace.snapshot.number}
        </a>
      </div>
      <div className="grid gap-1 text-[var(--muted)]">
        <div className="flex justify-between gap-3">
          <span>Head</span>
          <span className="truncate font-mono text-[var(--foreground)]">{workspace.snapshot.headSha.slice(0, 12)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Imported</span>
          <span className="text-[var(--foreground)]">{formatDate(workspace.snapshot.importedAt)}</span>
        </div>
      </div>
    </div>
  );
}

function GuideRail({ autoGenerate, workspace }: { autoGenerate: boolean; workspace: ReviewWorkspaceData }) {
  if (workspace.state === "imported") {
    return (
      <StatePanel
        action={
          <CodeReviewGuideGenerationControl
            autoStart={autoGenerate}
            snapshotId={workspace.snapshot.id}
          />
        }
        description="This PR snapshot is stored, but no guided review has been generated yet."
        icon={<Clock3 aria-hidden="true" className="size-4" />}
        title="Guide not generated"
      />
    );
  }

  if (workspace.state === "preparing") {
    return (
      <StatePanel
        description="agents-daemon is preparing the guided review for this PR snapshot."
        icon={<Clock3 aria-hidden="true" className="size-4" />}
        title="Guide preparing"
      />
    );
  }

  if (workspace.state === "failed") {
    return (
      <StatePanel
        action={
          <CodeReviewGuideGenerationControl
            force
            label="Retry generation"
            snapshotId={workspace.snapshot.id}
          />
        }
        description={workspace.generation?.error ?? workspace.guide?.error ?? "Guide generation failed."}
        icon={<AlertTriangle aria-hidden="true" className="size-4" />}
        title="Guide failed"
        tone="danger"
      />
    );
  }

  if (!workspace.guide) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--muted)]">
            <ListChecks aria-hidden="true" className="size-3.5" />
            Overview
          </div>
          <CodeReviewGuideGenerationControl
            force
            snapshotId={workspace.snapshot.id}
          />
        </div>
        <p className="text-sm leading-6">{workspace.guide.overview}</p>
      </div>

      <div className="overflow-hidden rounded-md border border-[var(--border)]">
        {workspace.guide.sections.map((section, index) => (
          <article className="border-b border-[var(--border)] p-3 last:border-b-0" key={section.id}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <h2 className="min-w-0 text-sm font-semibold">
                {index + 1}. {section.title}
              </h2>
              <RiskBadge riskLevel={section.riskLevel} />
            </div>
            <p className="mb-2 text-xs leading-5 text-[var(--muted)]">{section.summary}</p>
            <p className="mb-3 text-sm leading-6">{section.narrative}</p>
            <div className="grid gap-1">
              {section.files.map((file) => (
                <div className="rounded-sm bg-[var(--panel-subtle)] px-2 py-1 text-xs" key={file.id}>
                  <div className="truncate font-mono">{file.path}</div>
                  <div className="text-[var(--muted)]">{file.reason}</div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function StatePanel({
  description,
  icon,
  action,
  title,
  tone = "muted",
}: {
  action?: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
  tone?: "danger" | "muted";
}) {
  return (
    <div className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
      <div className={tone === "danger" ? "flex items-center gap-2 text-sm font-semibold text-[var(--danger)]" : "flex items-center gap-2 text-sm font-semibold"}>
        {icon}
        {title}
      </div>
      <p className="text-xs leading-5 text-[var(--muted)]">{description}</p>
      {action}
    </div>
  );
}

function ChangedFiles({
  files,
  selectedPath,
}: {
  files: ReviewWorkspaceData["files"];
  selectedPath: string | null;
}) {
  return (
    <div className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
        <FileCode2 aria-hidden="true" className="size-3.5" />
        Changed files
      </div>
      <div className="divide-y divide-[var(--border)]">
        {files.map((file) => (
          <div
            className="grid gap-1 px-3 py-2 data-[active=true]:border-l-2 data-[active=true]:border-l-[var(--accent)] data-[active=true]:bg-[var(--panel-subtle)]"
            data-active={file.path === selectedPath}
            key={file.id}
          >
            <div className="truncate font-mono text-xs font-medium">{file.path}</div>
            <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
              <span>{file.status}</span>
              <span>
                +{file.additions} -{file.deletions}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffPreview({ file }: { file: ReviewWorkspaceData["files"][number] | null }) {
  if (!file) {
    return (
      <div className="grid place-items-center bg-[var(--panel-subtle)] p-4 text-sm text-[var(--muted)]">
        No changed files were captured for this snapshot.
      </div>
    );
  }

  const lines = (file.patch ?? "Patch is not available for this file.").split("\n").slice(0, 80);

  return (
    <div className="bg-[var(--panel-subtle)] p-3">
      <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--code-panel)] font-mono text-xs">
        <div className="border-b border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-[var(--muted)]">
          {file.path}
        </div>
        <pre className="max-h-[calc(100vh-188px)] overflow-auto p-3 leading-5">
          {lines.map((line, index) => (
            <code className={classNameForPatchLine(line)} key={`${index}-${line}`}>
              {line || " "}
              {"\n"}
            </code>
          ))}
        </pre>
      </div>
    </div>
  );
}

function WorkspaceStatusBadge({ workspace }: { workspace: ReviewWorkspaceData }) {
  switch (workspace.state) {
    case "ready":
      return (
        <Badge tone="success">
          <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
          ready
        </Badge>
      );
    case "failed":
      return <Badge tone="danger">failed</Badge>;
    case "preparing":
      return <Badge tone="warning">preparing</Badge>;
    case "imported":
      return <Badge tone="muted">imported</Badge>;
  }
}

function RiskBadge({ riskLevel }: { riskLevel: string }) {
  if (riskLevel === "high") return <Badge tone="danger">high</Badge>;
  if (riskLevel === "medium") return <Badge tone="warning">medium</Badge>;
  return <Badge tone="muted">low</Badge>;
}

function classNameForPatchLine(line: string) {
  if (line.startsWith("+")) return "block text-[var(--diff-add-foreground)]";
  if (line.startsWith("-")) return "block text-[var(--danger)]";
  return "block text-[var(--muted)]";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
