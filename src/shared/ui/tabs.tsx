import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn.pure";

type TabItem = {
  id: string;
  icon?: ReactNode;
  label: string;
};

type TabsProps = HTMLAttributes<HTMLElement> & {
  active: string;
  items: TabItem[];
};

export function Tabs({ active, className, items, ...props }: TabsProps) {
  return (
    <nav
      aria-label="Review views"
      className={cn("grid border-b border-[var(--border)] text-xs font-medium", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      {...props}
    >
      {items.map((item) => (
        <span
          aria-current={item.id === active ? "page" : undefined}
          className="flex h-9 items-center justify-center gap-1.5 border-r border-[var(--border)] px-2 text-[var(--muted)] last:border-r-0 aria-current:bg-[var(--foreground)] aria-current:text-[var(--background)]"
          key={item.id}
        >
          {item.icon}
          {item.label}
        </span>
      ))}
    </nav>
  );
}
