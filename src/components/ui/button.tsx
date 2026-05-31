import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

const variantClassName: Record<ButtonVariant, string> = {
  primary: "bg-[var(--button)] text-[var(--button-foreground)] hover:opacity-90",
  secondary:
    "border border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--foreground)] hover:bg-[var(--panel-strong)]",
  ghost: "text-[var(--muted)] hover:bg-[var(--panel-subtle)] hover:text-[var(--foreground)]",
};

const sizeClassName: Record<ButtonSize, string> = {
  sm: "h-8 px-2 text-xs",
  md: "h-9 px-3 text-sm",
  icon: "size-8 justify-center p-0",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({ className, size = "md", variant = "secondary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-md font-medium outline-none transition disabled:pointer-events-none disabled:opacity-55",
        variantClassName[variant],
        sizeClassName[size],
        className,
      )}
      {...props}
    />
  );
}
