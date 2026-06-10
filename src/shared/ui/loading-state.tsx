import { cn } from "@/shared/lib/cn.pure";

type LoadingStateProps = {
  className?: string;
  label?: string;
};

export function LoadingState({ className, label = "Loading" }: LoadingStateProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-[var(--muted)]", className)}>
      <span className="size-3 animate-spin rounded-full border border-[var(--border)] border-t-[var(--accent)]" />
      <span>{label}</span>
    </div>
  );
}
