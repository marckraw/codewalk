'use client'

import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/cn.pure'
import type { ThemePreference } from './theme.pure'
import { useThemePreference } from './use-theme-preference'

const themeOptions = [
  { icon: Sun, label: 'Light', value: 'light' },
  { icon: Moon, label: 'Dark', value: 'dark' },
  { icon: Monitor, label: 'System', value: 'system' },
] as const satisfies ReadonlyArray<{
  icon: typeof Sun
  label: string
  value: ThemePreference
}>

export function ThemeModeToggle() {
  const { preference, setPreference } = useThemePreference()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const TriggerIcon =
    themeOptions.find((item) => item.value === preference)?.icon ?? Monitor

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Theme: ${themeOptions.find((item) => item.value === preference)?.label ?? 'System'}`}
        onClick={() => setOpen((current) => !current)}
        size="icon"
        suppressHydrationWarning
        type="button"
        variant="secondary"
      >
        <TriggerIcon aria-hidden="true" className="size-4" />
      </Button>
      {open ? (
        <div
          className="absolute top-full right-0 z-50 mt-1 min-w-36 rounded-md border border-[var(--border)] bg-[var(--panel)] p-1 shadow-md"
          role="menu"
        >
          {themeOptions.map(({ icon: Icon, label, value }) => {
            const selected = preference === value

            return (
              <button
                key={value}
                aria-checked={selected}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--panel-subtle)]',
                  selected && 'bg-[var(--panel-subtle)]',
                )}
                onClick={() => {
                  setPreference(value)
                  setOpen(false)
                }}
                role="menuitemradio"
                type="button"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {selected ? (
                  <Check aria-hidden="true" className="size-4 shrink-0" />
                ) : (
                  <span aria-hidden="true" className="size-4 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
