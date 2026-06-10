'use client'

import { useMemo, type FC } from 'react'
import { cn } from '@/shared/lib/cn.pure'
import {
  buildPierreChangedFilesTreeInput,
  type PierreChangedFileInput,
  type PierreChangedFilesTreeInput,
} from './changed-files-tree.pure'
import { ChangedFilesTreeModel } from './changed-files-tree-model'

interface ChangedFilesTreeProps {
  className?: string
  emptyMessage?: string
  files: PierreChangedFileInput[]
  loading?: boolean
  onSelectFile?: (file: string) => void
  search?: boolean
  selectedFile: string | null
}

export const ChangedFilesTree: FC<ChangedFilesTreeProps> = ({
  className,
  emptyMessage = 'No changed files detected',
  files,
  loading = false,
  onSelectFile,
  search = true,
  selectedFile,
}) => {
  const treeInput = useMemo(
    () => buildPierreChangedFilesTreeInput({ files }),
    [files],
  )
  const treeKey = buildTreeModelKey(treeInput)

  if (loading) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Loading changed files...
      </div>
    )
  }

  if (treeInput.paths.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">{emptyMessage}</div>
    )
  }

  return (
    <div className={cn('min-h-0 flex-1 overflow-hidden', className)}>
      <ChangedFilesTreeModel
        key={treeKey}
        onSelectFile={onSelectFile}
        search={search}
        selectedFile={selectedFile}
        treeInput={treeInput}
      />
    </div>
  )
}

function buildTreeModelKey(treeInput: PierreChangedFilesTreeInput): string {
  return JSON.stringify({
    gitStatus: treeInput.gitStatus,
    paths: treeInput.paths,
  })
}
