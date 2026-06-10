export type ThemePreference = 'light' | 'dark' | 'system'

export type AppliedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'codewalk-theme'

export function parseThemePreference(stored: string | null): ThemePreference {
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'system'
}

export function resolveAppliedTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): AppliedTheme {
  if (preference === 'dark') {
    return 'dark'
  }

  if (preference === 'light') {
    return 'light'
  }

  return prefersDark ? 'dark' : 'light'
}
