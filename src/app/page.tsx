import { OpenPullRequestDialog } from "@/components/open-pull-request-dialog";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { APP_NAME, REVIEW_TABS } from "@/lib/product";

const previewFiles = [
  { path: "src/app/review/[id]/page.tsx", status: "modified", count: "+84 -17" },
  { path: "src/server/github/pull-request.ts", status: "added", count: "+132" },
  { path: "drizzle/schema.ts", status: "modified", count: "+46 -3" },
  { path: "src/components/diff/file-tree.tsx", status: "added", count: "+97" },
];

const guideSections = [
  {
    title: "Import boundary",
    risk: "High",
    summary: "GitHub REST responses are normalized before persistence.",
  },
  {
    title: "Review workspace",
    risk: "Medium",
    summary: "The PR workspace keeps Activity, Overview, Guide, and Diff close.",
  },
  {
    title: "Diff primitives",
    risk: "Medium",
    summary: "Changed files map into tree and diff inputs for review.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--panel)]">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 sm:px-6">
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
            <button
              className="h-9 rounded-md bg-[var(--button)] px-3 text-sm font-medium text-[var(--button-foreground)]"
              type="button"
            >
              Sign in with GitHub
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-md border border-[var(--border)] bg-[var(--panel)]">
          <nav className="grid grid-cols-4 border-b border-[var(--border)] text-xs font-medium">
            {REVIEW_TABS.map((tab) => (
              <span
                className="border-r border-[var(--border)] px-2 py-2 text-center last:border-r-0 data-[active=true]:bg-[var(--foreground)] data-[active=true]:text-white"
                data-active={tab === "Guide"}
                key={tab}
              >
                {tab}
              </span>
            ))}
          </nav>

          <div className="p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase text-[var(--muted)]">Guide</h2>
              <span className="rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--muted)]">
                mocked
              </span>
            </div>
            <div className="overflow-hidden rounded-md border border-[var(--border)]">
              {guideSections.map((section, index) => (
                <article
                  className="border-b border-[var(--border)] bg-[var(--panel)] p-2.5 last:border-b-0 data-[active=true]:border-l-2 data-[active=true]:border-l-[var(--accent)] data-[active=true]:bg-[var(--panel-subtle)]"
                  data-active={index === 0}
                  key={section.title}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold">
                      {index + 1}. {section.title}
                    </h3>
                    <span className="rounded-sm border border-[var(--border)] bg-[var(--panel)] px-1.5 py-0.5 text-xs">
                      {section.risk}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">{section.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-h-[calc(100vh-88px)] rounded-md border border-[var(--border)] bg-[var(--panel)]">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
            <div>
              <h2 className="text-sm font-semibold">Workspace Preview</h2>
              <p className="text-xs text-[var(--muted)]">Unauthenticated foundation state</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-sm border border-[var(--border)] px-2 py-1 text-[var(--success)]">
                4 files
              </span>
              <span className="rounded-sm border border-[var(--border)] px-2 py-1 text-[var(--warning)]">
                3 sections
              </span>
            </div>
          </div>

          <div className="grid min-h-[calc(100vh-137px)] lg:grid-cols-[260px_1fr]">
            <div className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
              <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
                Changed files
              </div>
              <div className="divide-y divide-[var(--border)]">
                {previewFiles.map((file) => (
                  <div
                    className="grid gap-1 px-3 py-2 data-[active=true]:border-l-2 data-[active=true]:border-l-[var(--accent)] data-[active=true]:bg-[var(--panel-subtle)]"
                    data-active={file.path.includes("github")}
                    key={file.path}
                  >
                    <div className="truncate text-xs font-medium">{file.path}</div>
                    <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                      <span>{file.status}</span>
                      <span>{file.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--panel-subtle)] p-3">
              <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--code-panel)] font-mono text-xs">
                <div className="border-b border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-[var(--muted)]">
                  src/server/github/pull-request.ts
                </div>
                <div className="grid">
                  <code className="border-b border-[var(--diff-add-border)] bg-[var(--diff-add-background)] px-3 py-1 text-[var(--diff-add-foreground)]">
                    + export async function importPullRequest(url: PullRequestUrl) {" {"}
                  </code>
                  <code className="border-b border-[var(--diff-add-border)] bg-[var(--diff-add-background)] px-3 py-1 text-[var(--diff-add-foreground)]">
                    +   const metadata = await github.getPullRequest(url);
                  </code>
                  <code className="border-b border-[var(--diff-add-border)] bg-[var(--diff-add-background)] px-3 py-1 text-[var(--diff-add-foreground)]">
                    +   const files = await github.listPullRequestFiles(url);
                  </code>
                  <code className="px-3 py-1 text-[var(--diff-add-foreground)]">+   return normalizeSnapshot(metadata, files);</code>
                  <code className="px-3 py-1 text-[var(--diff-add-foreground)]">+ {"}"}</code>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
