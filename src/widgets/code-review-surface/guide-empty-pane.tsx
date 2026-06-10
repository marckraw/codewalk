import type { ReviewWorkspace } from "./review-types";

export function GuideEmptyPane({ workspace }: { workspace: ReviewWorkspace }) {
  return (
    <main className="flex min-w-0 items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-md border border-border bg-card p-4 text-center">
        <h2 className="text-sm font-semibold">Guide not generated</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          This PR snapshot is stored, but no guided review has been generated yet. Use the guide rail to start generation.
        </p>
        {workspace.state === "failed" ? (
          <p className="mt-2 text-xs leading-5 text-destructive">
            {workspace.generation?.error ?? workspace.guide?.error ?? "Guide generation failed."}
          </p>
        ) : null}
      </div>
    </main>
  );
}
