import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";

interface ModeButtonProps {
  active: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}

export function ModeButton({ active, disabled = false, icon, label, onClick }: ModeButtonProps) {
  return (
    <Button
      className="h-7 px-2 text-xs"
      disabled={disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant={active ? "secondary" : "ghost"}
    >
      {icon}
      {label}
    </Button>
  );
}
