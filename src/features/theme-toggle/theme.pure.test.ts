import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveAppliedTheme } from './theme.pure'

describe('parseThemePreference', () => {
  it('returns stored light, dark, and system values', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
  })

  it('defaults missing or invalid values to system', () => {
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference('')).toBe('system')
    expect(parseThemePreference('sepia')).toBe('system')
  })
})

describe('resolveAppliedTheme', () => {
  it('forces light and dark preferences', () => {
    expect(resolveAppliedTheme('light', true)).toBe('light')
    expect(resolveAppliedTheme('dark', false)).toBe('dark')
  })

  it('follows the system preference when set to system', () => {
    expect(resolveAppliedTheme('system', true)).toBe('dark')
    expect(resolveAppliedTheme('system', false)).toBe('light')
  })
})
