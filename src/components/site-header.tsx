import Link from "next/link";
import { AuthControls } from "@/components/auth/auth-controls";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { Toolbar } from "@/components/ui/toolbar";
import { APP_NAME } from "@/lib/product";

/**
 * App-wide header: brand links back to the reviews dashboard and the nav keeps
 * every page one click from home.
 */
export function SiteHeader() {
  return (
    <header>
      <Toolbar>
        <div className="flex min-w-0 items-center gap-3">
          <Link className="flex min-w-0 items-center gap-3 outline-none" href="/">
            <div className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] text-sm font-semibold">
              C
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold">{APP_NAME}</span>
              <span className="block truncate text-xs text-[var(--muted)]">Guided pull request review</span>
            </div>
          </Link>
          <nav aria-label="Primary" className="ml-2 hidden items-center gap-1 sm:flex">
            <Link
              className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--panel-subtle)] hover:text-[var(--foreground)]"
              href="/"
            >
              Reviews
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeModeToggle />
          <AuthControls />
        </div>
      </Toolbar>
    </header>
  );
}
