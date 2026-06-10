import type { GitStatus, GitStatusEntry } from "@pierre/trees";

export interface PierreChangedFileInput {
  file: string;
  status: GitStatus | string;
}

export interface PierreChangedFilesTreeInput {
  gitStatus: GitStatusEntry[];
  paths: string[];
}

export function buildPierreChangedFilesTreeInput(input: { files: PierreChangedFileInput[] }): PierreChangedFilesTreeInput {
  const paths: string[] = [];
  const statusByPath = new Map<string, GitStatus>();

  for (const changedFile of input.files) {
    const path = normalizeChangedFilePath(changedFile.file);
    if (!path) {
      continue;
    }

    if (!statusByPath.has(path)) {
      paths.push(path);
    }

    statusByPath.set(path, mapChangedFileStatusToPierre(changedFile.status));
  }

  return {
    gitStatus: paths.map((path) => ({
      path,
      status: statusByPath.get(path) ?? "modified",
    })),
    paths,
  };
}

export function mapChangedFileStatusToPierre(status: GitStatus | string): GitStatus {
  if (isPierreGitStatus(status)) {
    return status;
  }

  const normalized = status.trim().toUpperCase();
  const word = normalized.toLowerCase();

  if (word === "removed") {
    return "deleted";
  }
  if (word === "changed") {
    return "modified";
  }

  if (normalized.includes("?")) {
    return "untracked";
  }
  if (normalized.includes("!")) {
    return "ignored";
  }
  if (normalized.includes("R")) {
    return "renamed";
  }
  if (normalized.includes("A") && !normalized.includes("D")) {
    return "added";
  }
  if (normalized.includes("D") && !normalized.includes("A")) {
    return "deleted";
  }

  return "modified";
}

export function normalizeChangedFilePath(file: string): string {
  return file.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

function isPierreGitStatus(status: string): status is GitStatus {
  return (
    status === "added" ||
    status === "deleted" ||
    status === "ignored" ||
    status === "modified" ||
    status === "renamed" ||
    status === "untracked"
  );
}
