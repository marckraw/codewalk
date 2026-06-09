import { AlertTriangle, Clock3, ListChecks, Sparkles } from "lucide-react";
import { CodeReviewGuideGenerationControl } from "@/components/code-review-guide-generation-control";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ReviewWorkspace } from "./review-types";

interface GuideRailProps {
  activeSectionId: string | null;
  autoGenerate: boolean;
  onGenerationStart?: () => void;
  onSelectSection: (sectionId: string) => void;
  workspace: ReviewWorkspace;
}

export function GuideRail({ activeSectionId, autoGenerate, onGenerationStart, onSelectSection, workspace }: GuideRailProps) {
  return (
    <aside className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Guide</span>
        <span className="text-xs text-muted-foreground">{workspace.guide?.sections.length ?? 0}</span>
      </div>
      <div className="border-b border-border px-3 py-2">
        {renderGuideGenerationState({ autoGenerate, onGenerationStart, workspace })}
      </div>
      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {!workspace.guide || workspace.guide.sections.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No guide sections yet.</p>
        ) : null}
        {workspace.guide?.sections.map((section, index) => {
          const active = activeSectionId === section.id;

          return (
            <Button
              key={section.id}
              className={cn(
                "mb-1 flex h-auto min-h-[58px] w-full min-w-0 items-start justify-start gap-2 whitespace-normal rounded-md border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/10"
                  : "border-transparent hover:border-border hover:bg-[var(--panel-subtle)]",
              )}
              onClick={() => onSelectSection(section.id)}
              type="button"
              variant="ghost"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-border text-[10px] text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm leading-5 font-medium">{section.title}</span>
                <span className="block text-xs leading-4 text-muted-foreground">
                  {section.files.length} files · {section.riskLevel} risk
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}

function renderGuideGenerationState({
  autoGenerate,
  onGenerationStart,
  workspace,
}: {
  autoGenerate: boolean;
  onGenerationStart?: () => void;
  workspace: ReviewWorkspace;
}) {
  if (workspace.state === "imported") {
    return (
      <div className="grid gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Clock3 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase">Draft guide</p>
            <p className="mt-1 text-xs text-muted-foreground">Generation has not started.</p>
          </div>
        </div>
        <CodeReviewGuideGenerationControl
          autoStart={autoGenerate}
          onGenerationStart={onGenerationStart}
          snapshotId={workspace.snapshot.id}
        />
      </div>
    );
  }

  if (workspace.state === "preparing") {
    return (
      <div className="flex min-w-0 items-start gap-2">
        <Clock3 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase">AI guide</p>
          <p className="mt-1 text-xs text-muted-foreground">Generating...</p>
        </div>
      </div>
    );
  }

  if (workspace.state === "failed") {
    return (
      <div className="grid gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-[10px] text-destructive uppercase">Guide failed</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {workspace.generation?.error ?? workspace.guide?.error ?? "Generation failed."}
            </p>
          </div>
        </div>
        <CodeReviewGuideGenerationControl
          force
          label="Retry generation"
          onGenerationStart={onGenerationStart}
          snapshotId={workspace.snapshot.id}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase">
          <ListChecks className="size-3" />
          {workspace.guide?.generatedBy === "agent" ? "AI guide" : "Draft guide"}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">Ready for review.</p>
      </div>
      <CodeReviewGuideGenerationControl force onGenerationStart={onGenerationStart} snapshotId={workspace.snapshot.id} />
    </div>
  );
}

export function GuidePreparingPane() {
  return (
    <main className="flex min-w-0 items-center justify-center bg-background p-6" role="status">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 animate-pulse" />
        Generating guide...
      </div>
    </main>
  );
}
