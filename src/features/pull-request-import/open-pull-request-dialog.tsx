'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { GitPullRequestArrow, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { TextField } from '@/shared/ui/text-field'
import {
  formatPullRequestRef,
  parseGitHubPullRequestUrl,
  type GitHubPullRequestRef,
} from '@/entities/github'

type PullRequestImportResponse = {
  counts?: {
    comments: number
    commits: number
    files: number
  }
  error?: string
  pullRequest?: GitHubPullRequestRef
  snapshot?: {
    headSha: string
    id: string
  }
}

export function OpenPullRequestDialog() {
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importResult, setImportResult] =
    useState<PullRequestImportResponse | null>(null)
  const [isNavigating, startNavigation] = useTransition()
  const router = useRouter()
  const titleId = useId()
  const descriptionId = useId()

  async function submitPullRequestUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const url = String(formData.get('pull-request-url') ?? '')
    const parsed = parseGitHubPullRequestUrl(url)

    setImportResult(null)

    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/pull-requests/import', {
        body: JSON.stringify({ url }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const body = await readPullRequestImportResponse(response)

      if (!response.ok || !body.pullRequest || !body.snapshot || !body.counts) {
        setError(
          body.error ??
            `The pull request import request failed with HTTP ${response.status}.`,
        )
        return
      }

      setImportResult(body)
      // Keep the button in its pending state through the navigation, not just
      // the fetch — otherwise it flips back to "Import PR" while the review
      // page is still loading.
      const snapshotId = body.snapshot.id
      startNavigation(() => {
        router.push(`/review/${encodeURIComponent(snapshotId)}?generate=1`)
      })
    } catch {
      setError('The pull request import route is unavailable.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button">
        <GitPullRequestArrow aria-hidden="true" className="size-4" />
        Open pull request
      </Button>

      {isOpen ? (
        <div
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
        >
          <form
            className="w-full max-w-lg overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] shadow-xl"
            onSubmit={submitPullRequestUrl}
          >
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold" id={titleId}>
                Open pull request
              </h2>
              <p
                className="mt-1 text-xs text-[var(--muted)]"
                id={descriptionId}
              >
                Paste a GitHub pull request URL to import it into Codewalk.
              </p>
            </div>

            <div className="grid gap-2 px-4 py-4">
              <label
                className="text-xs font-medium text-[var(--muted)]"
                htmlFor="pull-request-url"
              >
                Pull request URL
              </label>
              <TextField
                autoFocus
                id="pull-request-url"
                name="pull-request-url"
                placeholder="https://github.com/org/repo/pull/123"
                type="url"
              />
              {error ? (
                <p className="text-xs text-[var(--danger)]">{error}</p>
              ) : null}
              {importResult?.pullRequest && importResult.counts ? (
                <p className="text-xs text-[var(--success)]">
                  Imported {formatPullRequestRef(importResult.pullRequest)} with{' '}
                  {importResult.counts.files} files,{' '}
                  {importResult.counts.commits} commits, and{' '}
                  {importResult.counts.comments} comments.
                </p>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  Codewalk stores a reusable snapshot with PR metadata, files,
                  commits, and available comments.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--panel-subtle)] px-4 py-3">
              <Button
                onClick={() => setIsOpen(false)}
                type="button"
                variant="secondary"
              >
                <X aria-hidden="true" className="size-4" />
                Cancel
              </Button>
              <Button
                disabled={isSubmitting || isNavigating}
                type="submit"
                variant="primary"
              >
                {isSubmitting || isNavigating ? 'Importing' : 'Import PR'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}

async function readPullRequestImportResponse(
  response: Response,
): Promise<PullRequestImportResponse> {
  const contentType = response.headers.get('Content-Type') ?? ''

  if (!contentType.toLowerCase().includes('application/json')) {
    return {}
  }

  return (await response.json()) as PullRequestImportResponse
}
