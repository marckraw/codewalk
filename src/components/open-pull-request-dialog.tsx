"use client";

import { useId, useState } from "react";

export function OpenPullRequestDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <button
        className="h-9 rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--panel-strong)]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Open pull request
      </button>

      {isOpen ? (
        <div
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] shadow-xl">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="text-sm font-semibold" id={titleId}>
                Open pull request
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]" id={descriptionId}>
                Paste a GitHub pull request URL to import it into Codewalk.
              </p>
            </div>

            <div className="grid gap-2 px-4 py-4">
              <label className="text-xs font-medium text-[var(--muted)]" htmlFor="pull-request-url">
                Pull request URL
              </label>
              <input
                autoFocus
                className="h-10 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                id="pull-request-url"
                placeholder="https://github.com/org/repo/pull/123"
                type="url"
              />
              <p className="text-xs text-[var(--muted)]">
                Import is mocked in this scaffold. Real validation lands with the PR import tickets.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--panel-subtle)] px-4 py-3">
              <button
                className="h-9 rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--panel-strong)]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-9 rounded-md bg-[var(--button)] px-3 text-sm font-medium text-[var(--button-foreground)] opacity-60"
                disabled
                type="button"
              >
                Import PR
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
