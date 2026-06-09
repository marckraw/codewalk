"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, GitCompareArrows, GitPullRequestArrow, ListTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileRail } from "./file-rail";
import { GuidePreparingPane, GuideRail } from "./guide-rail";
import { GuideView } from "./guide-view";
import { ModeButton } from "./mode-button";
import { PierreDiffViewer } from "./pierre-diff-viewer";
import type { ReviewFile, ReviewMode, ReviewWorkspace as ReviewWorkspaceModel } from "./review-types";
import { useReviewWorkspaceLive } from "./use-review-workspace-live";

interface ReviewWorkspaceProps {
  autoGenerate: boolean;
  workspace: ReviewWorkspaceModel;
}

export function ReviewWorkspace({ autoGenerate, workspace: initialWorkspace }: ReviewWorkspaceProps) {
  const { markGenerationStarted, workspace } = useReviewWorkspaceLive(initialWorkspace, { autoGenerate });
  const [selectedView, setSelectedView] = useState<ReviewMode>(
    initialWorkspace.guide ||
      autoGenerate ||
      initialWorkspace.state === "preparing" ||
      initialWorkspace.state === "failed"
      ? "guide"
      : "diff",
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(workspace.files[0]?.path ?? null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeGuideSectionId, setActiveGuideSectionId] = useState<string | null>(workspace.guide?.sections[0]?.id ?? null);
  const guideSectionRefs = useRef(new Map<string, HTMLElement>());
  const guideFileRefs = useRef(new Map<string, HTMLElement>());

  const statusCounts = useMemo(() => countFilesByStatus(workspace.files), [workspace.files]);
  const visibleFiles = useMemo(
    () => (statusFilter === "all" ? workspace.files : workspace.files.filter((file) => file.status === statusFilter)),
    [statusFilter, workspace.files],
  );
  const selectedVisibleFile = useMemo(
    () => visibleFiles.find((file) => file.path === selectedFile)?.path ?? null,
    [selectedFile, visibleFiles],
  );
  const effectiveActiveGuideSectionId = useMemo(() => {
    if (!workspace.guide || workspace.guide.sections.length === 0) {
      return null;
    }

    if (activeGuideSectionId && workspace.guide.sections.some((section) => section.id === activeGuideSectionId)) {
      return activeGuideSectionId;
    }

    return workspace.guide.sections[0].id;
  }, [activeGuideSectionId, workspace.guide]);
  const diffByPath = useMemo(() => new Map(workspace.files.map((file) => [file.path, file.patch ?? ""])), [workspace.files]);
  const selectedDiff = selectedFile ? diffByPath.get(selectedFile) ?? "" : "";

  useEffect(() => {
    if (selectedView !== "guide" || !workspace.guide || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observedSections = workspace.guide.sections
      .map((section) => ({
        id: section.id,
        node: guideSectionRefs.current.get(section.id),
      }))
      .filter((entry): entry is { id: string; node: HTMLElement } => entry.node !== undefined);

    if (observedSections.length === 0) {
      return;
    }

    const sectionIdByNode = new Map(observedSections.map((section) => [section.node, section.id]));
    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const sectionId = activeEntry ? sectionIdByNode.get(activeEntry.target as HTMLElement) ?? null : null;

        if (sectionId) {
          setActiveGuideSectionId(sectionId);
        }
      },
      {
        root: null,
        rootMargin: "-18% 0px -60% 0px",
        threshold: 0,
      },
    );

    for (const section of observedSections) {
      observer.observe(section.node);
    }

    return () => observer.disconnect();
  }, [selectedView, workspace.guide]);

  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedFile(filePath);
  }, []);

  const handleStatusFilterChange = useCallback((nextFilter: string) => {
    setStatusFilter(nextFilter);
    setSelectedFile(null);
  }, []);

  const handleSelectGuideSection = useCallback((sectionId: string) => {
    setActiveGuideSectionId(sectionId);
    guideSectionRefs.current.get(sectionId)?.scrollIntoView({ block: "start", inline: "nearest" });
  }, []);

  const handleSelectGuideFile = useCallback((filePath: string) => {
    setSelectedFile(filePath);
    guideFileRefs.current.get(filePath)?.scrollIntoView({ block: "start", inline: "nearest" });
  }, []);

  const renderGuideSectionRef = useCallback(
    (sectionId: string) => (node: HTMLElement | null) => {
      if (node) {
        guideSectionRefs.current.set(sectionId, node);
        return;
      }

      guideSectionRefs.current.delete(sectionId);
    },
    [],
  );

  const renderGuideFileRef = useCallback(
    (filePath: string) => (node: HTMLElement | null) => {
      if (node) {
        guideFileRefs.current.set(filePath, node);
        return;
      }

      guideFileRefs.current.delete(filePath);
    },
    [],
  );

  return (
    <section className="flex h-[calc(100vh-57px)] min-h-[680px] flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-2">
          <GitPullRequestArrow className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{workspace.snapshot.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {workspace.snapshot.owner}/{workspace.snapshot.repo} · #{workspace.snapshot.number} · {workspace.snapshot.baseRef} →{" "}
              {workspace.snapshot.headRef}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            <ModeButton
              active={selectedView === "guide"}
              disabled={!workspace.guide && workspace.state !== "imported" && workspace.state !== "preparing" && workspace.state !== "failed"}
              icon={<ListTree className="size-3.5" />}
              label="Guide"
              onClick={() => setSelectedView("guide")}
            />
            <ModeButton
              active={selectedView === "diff"}
              icon={<GitCompareArrows className="size-3.5" />}
              label="Diff"
              onClick={() => setSelectedView("diff")}
            />
          </div>
          <Badge tone="success">{workspace.files.length} files</Badge>
          {workspace.guide ? <Badge tone="warning">{workspace.guide.sections.length} sections</Badge> : null}
          <WorkspaceStatusBadge workspace={workspace} />
          <Button asChild className="h-8 gap-1.5 px-2 text-xs" size="sm" variant="outline">
            <a href={workspace.snapshot.url} rel="noreferrer" target="_blank">
              <GitPullRequestArrow className="size-3.5" />
              Pull Request
            </a>
          </Button>
        </div>
      </div>

      <div className="relative grid min-h-0 flex-1 grid-rows-[minmax(180px,280px)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
        {selectedView === "guide" ? (
          <>
            <GuideRail
              activeSectionId={effectiveActiveGuideSectionId}
              autoGenerate={autoGenerate}
              onGenerationStart={markGenerationStarted}
              onSelectSection={handleSelectGuideSection}
              workspace={workspace}
            />
            {workspace.state === "preparing" ? (
              <GuidePreparingPane />
            ) : workspace.guide ? (
              <GuideView
                getFileDiff={(filePath) => diffByPath.get(filePath) ?? ""}
                guide={workspace.guide}
                isFileLoading={() => false}
                onSelectFile={handleSelectGuideFile}
                renderFileRef={renderGuideFileRef}
                renderSectionRef={renderGuideSectionRef}
              />
            ) : (
              <GuideEmptyPane workspace={workspace} />
            )}
          </>
        ) : (
          <>
            <FileRail
              files={workspace.files}
              onSelectFile={handleSelectFile}
              onStatusFilterChange={handleStatusFilterChange}
              selectedFile={selectedVisibleFile}
              statusCounts={statusCounts}
              statusFilter={statusFilter}
              visibleFiles={visibleFiles}
            />
            <main className="min-w-0 overflow-hidden">
              <PierreDiffViewer diff={selectedDiff} file={selectedFile} title="Pull request diff" />
            </main>
          </>
        )}
      </div>
    </section>
  );
}

function WorkspaceStatusBadge({ workspace }: { workspace: ReviewWorkspaceModel }) {
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

function GuideEmptyPane({ workspace }: { workspace: ReviewWorkspaceModel }) {
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

function countFilesByStatus(files: ReviewFile[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const file of files) {
    counts[file.status] = (counts[file.status] ?? 0) + 1;
  }

  return counts;
}
