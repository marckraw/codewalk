'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  parseThemePreference,
  resolveAppliedTheme,
  THEME_STORAGE_KEY,
  type AppliedTheme,
  type ThemePreference,
} from './theme.pure'

function subscribeToSystemPreference(onChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

function getSystemPrefersDarkSnapshot() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getSystemPrefersDarkServerSnapshot() {
  return false
}

function applyTheme(theme: AppliedTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
}

export function useThemePreference() {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readStoredPreference)
  const prefersDark = useSyncExternalStore(
    subscribeToSystemPreference,
    getSystemPrefersDarkSnapshot,
    getSystemPrefersDarkServerSnapshot,
  )
  const appliedTheme = resolveAppliedTheme(preference, prefersDark)

  useEffect(() => {
    applyTheme(appliedTheme)
  }, [appliedTheme])

  function setPreference(nextPreference: ThemePreference) {
    setPreferenceState(nextPreference)
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference)
  }

  return {
    appliedTheme,
    preference,
    setPreference,
  }
}
