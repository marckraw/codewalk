import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/cn.pure";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center gap-2 rounded-md font-medium outline-none transition disabled:pointer-events-none disabled:opacity-55",
  {
    defaultVariants: {
      size: "md",
      variant: "secondary",
    },
    variants: {
      size: {
        icon: "size-8 justify-center p-0",
        md: "h-9 px-3 text-sm",
        sm: "h-8 px-2 text-xs",
      },
      variant: {
        ghost: "text-[var(--muted)] hover:bg-[var(--panel-subtle)] hover:text-[var(--foreground)]",
        outline: "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--panel-subtle)]",
        primary: "bg-[var(--button)] text-[var(--button-foreground)] hover:opacity-90",
        secondary:
          "border border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--foreground)] hover:bg-[var(--panel-strong)]",
      },
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
  asChild?: boolean;
};

export function Button({ asChild = false, className, size = "md", variant = "secondary", ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(buttonVariants({ size, variant }), className)}
      {...props}
    />
  );
}
