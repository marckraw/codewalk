'use client'

import { useSyncExternalStore } from 'react'

export type AppColorScheme = 'light' | 'dark'

function subscribe(onChange: () => void) {
  if (typeof document === 'undefined') {
    return () => {}
  }

  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributeFilter: ['class'],
    attributes: true,
  })
  return () => observer.disconnect()
}

function getSnapshot(): AppColorScheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * The app's current light/dark mode, tracked from the `dark` class on <html>.
 *
 * Needed because the Pierre diff/tree resolve their palette with `light-dark()`,
 * which follows the OS `prefers-color-scheme` rather than our class-based theme.
 * Reading it here lets callers pass an explicit theme so Pierre matches the app.
 */
export function useAppColorScheme(): AppColorScheme {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'light')
}
