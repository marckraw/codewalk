"use client";

import { FileCode2 } from "lucide-react";
import type { ReviewFile } from "./review-types";
import { ChangedFilesTree } from "./changed-files-tree";
import { StatusFilterButton } from "./status-filter-button";

interface FileRailProps {
  files: ReviewFile[];
  onSelectFile: (file: string) => void;
  onStatusFilterChange: (status: string) => void;
  selectedFile: string | null;
  statusCounts: Record<string, number>;
  statusFilter: string;
  visibleFiles: ReviewFile[];
}

export function FileRail({
  files,
  onSelectFile,
  onStatusFilterChange,
  selectedFile,
  statusCounts,
  statusFilter,
  visibleFiles,
}: FileRailProps) {
  const statuses = Object.keys(statusCounts).sort();

  return (
    <aside className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <FileCode2 className="size-3.5" />
          Changed files
        </span>
        <span className="text-xs text-muted-foreground">{files.length}</span>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1 border-b border-border px-2 py-2">
        <StatusFilterButton active={statusFilter === "all"} count={files.length} label="All" onClick={() => onStatusFilterChange("all")} />
        {statuses.map((status) => (
          <StatusFilterButton
            key={status}
            active={statusFilter === status}
            count={statusCounts[status] ?? 0}
            label={status}
            onClick={() => onStatusFilterChange(status)}
          />
        ))}
      </div>

      <ChangedFilesTree
        className="p-2"
        emptyMessage={statusFilter === "all" ? "No changed files detected" : `No ${statusFilter} files detected`}
        files={visibleFiles.map((file) => ({ file: file.path, status: file.status }))}
        onSelectFile={onSelectFile}
        selectedFile={selectedFile}
      />
    </aside>
  );
}
