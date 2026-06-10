import type { InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn.pure'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement>

export function TextField({ className, ...props }: TextFieldProps) {
  return (
    <input
      className={cn(
        'h-10 min-w-0 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}
