import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn.pure";

interface StatusFilterButtonProps {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}

export function StatusFilterButton({ active, count, label, onClick }: StatusFilterButtonProps) {
  return (
    <Button
      className={cn("h-7 px-2 text-xs", count === 0 && !active && "opacity-60")}
      onClick={onClick}
      size="sm"
      type="button"
      variant={active ? "secondary" : "ghost"}
    >
      {label} {count}
    </Button>
  );
}
