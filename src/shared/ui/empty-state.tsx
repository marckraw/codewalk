import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn.pure";

type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description: string;
  title: string;
};

export function EmptyState({ action, className, description, title }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "grid min-h-32 place-items-center rounded-md border border-dashed border-[var(--border)] bg-[var(--panel-subtle)] p-4 text-center",
        className,
      )}
    >
      <div className="grid gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
