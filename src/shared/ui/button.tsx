import { Slot } from '@radix-ui/react-slot'
import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/cn.pure'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center gap-2 rounded-md font-medium outline-none transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55',
  {
    defaultVariants: {
      size: 'md',
      variant: 'secondary',
    },
    variants: {
      size: {
        icon: 'size-8 justify-center p-0',
        md: 'h-9 px-3 text-sm',
        sm: 'h-8 px-2 text-xs',
      },
      variant: {
        ghost:
          'text-[var(--muted)] hover:bg-[var(--panel-subtle)] hover:text-[var(--foreground)]',
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--panel-subtle)]',
        primary:
          'bg-[var(--button)] text-[var(--button-foreground)] hover:opacity-90',
        secondary:
          'border border-[var(--border)] bg-[var(--panel-subtle)] text-[var(--foreground)] hover:bg-[var(--panel-strong)]',
      },
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Show a leading spinner and disable the button while an action runs.
     *  Ignored when `asChild` (a Slot must keep a single child). */
    pending?: boolean
  }

export function Button({
  asChild = false,
  children,
  className,
  disabled,
  pending = false,
  size = 'md',
  variant = 'secondary',
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  const showSpinner = !asChild && pending

  return (
    <Component
      aria-busy={showSpinner || undefined}
      className={cn(buttonVariants({ size, variant }), className)}
      disabled={disabled || showSpinner || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {showSpinner ? (
            <Loader2
              aria-hidden="true"
              className="size-3.5 shrink-0 animate-spin"
            />
          ) : null}
          {children}
        </>
      )}
    </Component>
  )
}
