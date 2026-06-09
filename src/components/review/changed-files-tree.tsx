"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useMemo, type FC } from "react";
import { FileTree as PierreFileTreeModel } from "@pierre/trees";
import { FileTree, useFileTreeSearch } from "@pierre/trees/react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { buildPierreChangedFilesTreeInput, type PierreChangedFileInput, type PierreChangedFilesTreeInput } from "./changed-files-tree.pure";

interface ChangedFilesTreeProps {
  className?: string;
  emptyMessage?: string;
  files: PierreChangedFileInput[];
  loading?: boolean;
  onSelectFile?: (file: string) => void;
  search?: boolean;
  selectedFile: string | null;
}

export const ChangedFilesTree: FC<ChangedFilesTreeProps> = ({
  className,
  emptyMessage = "No changed files detected",
  files,
  loading = false,
  onSelectFile,
  search = true,
  selectedFile,
}) => {
  const treeInput = useMemo(() => buildPierreChangedFilesTreeInput({ files }), [files]);
  const treeKey = buildTreeModelKey(treeInput);

  if (loading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading changed files...</div>;
  }

  if (treeInput.paths.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className={cn("min-h-0 flex-1 overflow-hidden", className)}>
      <ChangedFilesTreeModel
        key={treeKey}
        onSelectFile={onSelectFile}
        search={search}
        selectedFile={selectedFile}
        treeInput={treeInput}
      />
    </div>
  );
};

function buildTreeModelKey(treeInput: PierreChangedFilesTreeInput): string {
  return JSON.stringify({
    gitStatus: treeInput.gitStatus,
    paths: treeInput.paths,
  });
}

interface ChangedFilesTreeModelProps {
  onSelectFile?: (file: string) => void;
  search?: boolean;
  selectedFile: string | null;
  treeInput: PierreChangedFilesTreeInput;
}

function ChangedFilesTreeModel({ onSelectFile, search: searchEnabled = true, selectedFile, treeInput }: ChangedFilesTreeModelProps) {
  const model = useMemo(
    () =>
      new PierreFileTreeModel({
        density: "compact",
        fileTreeSearchMode: "hide-non-matches",
        flattenEmptyDirectories: true,
        gitStatus: treeInput.gitStatus,
        initialExpansion: "open",
        initialSelectedPaths: selectedFile ? [selectedFile] : [],
        onSelectionChange: (selectedPaths) => {
          const nextFile = selectedPaths[0];
          if (nextFile) {
            onSelectFile?.(nextFile);
          }
        },
        paths: treeInput.paths,
        search: searchEnabled,
        searchBlurBehavior: "retain",
      }),
    [onSelectFile, searchEnabled, selectedFile, treeInput.gitStatus, treeInput.paths],
  );

  useEffect(() => {
    return () => model.cleanUp();
  }, [model]);

  const treeSearch = useFileTreeSearch(model);

  useEffect(() => {
    const selectedPaths = model.getSelectedPaths();

    if (!selectedFile) {
      for (const path of selectedPaths) {
        model.getItem(path)?.deselect();
      }
      return;
    }

    if (selectedPaths.length === 1 && selectedPaths[0] === selectedFile) {
      return;
    }

    for (const path of selectedPaths) {
      if (path !== selectedFile) {
        model.getItem(path)?.deselect();
      }
    }

    const selectedItem = model.getItem(selectedFile);
    selectedItem?.select();
    selectedItem?.focus();
  }, [model, selectedFile]);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      treeSearch.setValue(null);
      treeSearch.close();
      return;
    }

    if (event.key === "Enter") {
      if (event.shiftKey) {
        treeSearch.focusPreviousMatch();
      } else {
        treeSearch.focusNextMatch();
      }
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {searchEnabled ? (
        <div className="flex h-8 shrink-0 items-center gap-1 px-1 pb-1">
          {treeSearch.isOpen ? (
            <>
              <TextField
                aria-label="Search changed files"
                className="h-7 min-w-0 flex-1 rounded px-2 font-mono text-xs"
                onChange={(event) => treeSearch.setValue(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search files"
                value={treeSearch.value ?? ""}
              />
              {treeSearch.value ? (
                <span className="w-10 text-right text-[10px] text-muted-foreground tabular-nums">
                  {treeSearch.matchingPaths.length}
                </span>
              ) : null}
              <Button
                aria-label="Previous search match"
                className="size-7"
                disabled={!treeSearch.value || treeSearch.matchingPaths.length === 0}
                onClick={treeSearch.focusPreviousMatch}
                size="icon"
                title="Previous match"
                type="button"
                variant="ghost"
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                aria-label="Next search match"
                className="size-7"
                disabled={!treeSearch.value || treeSearch.matchingPaths.length === 0}
                onClick={treeSearch.focusNextMatch}
                size="icon"
                title="Next match"
                type="button"
                variant="ghost"
              >
                <ChevronDown className="size-3.5" />
              </Button>
              <Button
                aria-label="Close changed-files search"
                className="size-7"
                onClick={() => {
                  treeSearch.setValue(null);
                  treeSearch.close();
                }}
                size="icon"
                title="Close search"
                type="button"
                variant="ghost"
              >
                <X className="size-3.5" />
              </Button>
            </>
          ) : (
            <Button
              aria-label="Search changed files"
              className="ml-auto size-7"
              onClick={() => treeSearch.open(treeSearch.value)}
              size="icon"
              title="Search changed files"
              type="button"
              variant="ghost"
            >
              <Search className="size-3.5" />
            </Button>
          )}
        </div>
      ) : null}
      <FileTree aria-label="Changed files" className="min-h-0 w-full flex-1" model={model} style={TREE_HOST_STYLE} />
    </div>
  );
}

const TREE_HOST_STYLE = {
  "--trees-border-color-override": "var(--border)",
  "--trees-fg-override": "var(--foreground)",
  "--trees-selected-bg-override": "color-mix(in srgb, var(--accent) 18%, transparent)",
} as CSSProperties;
