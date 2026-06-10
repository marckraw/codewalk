import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeModeToggle } from './theme-mode-toggle'
import { THEME_STORAGE_KEY } from './theme.pure'

function mockPrefersColorScheme(prefersDark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
  }))
}

describe('ThemeModeToggle', () => {
  beforeEach(() => {
    mockPrefersColorScheme(false)
  })

  afterEach(() => {
    cleanup()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('opens a menu with light, dark, and system options', async () => {
    render(<ThemeModeToggle />)

    await userEvent.click(screen.getByRole('button', { name: 'Theme: System' }))

    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toBeVisible()
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toBeVisible()
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeVisible()
  })

  it('switches to light mode from the menu', async () => {
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'

    render(<ThemeModeToggle />)

    await userEvent.click(screen.getByRole('button', { name: 'Theme: System' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Light' }))

    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(
      screen.getByRole('button', { name: 'Theme: Light' }),
    ).toBeInTheDocument()
  })

  it('switches to dark mode from the menu', async () => {
    render(<ThemeModeToggle />)

    await userEvent.click(screen.getByRole('button', { name: 'Theme: System' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(
      screen.getByRole('button', { name: 'Theme: Dark' }),
    ).toBeInTheDocument()
  })

  it('stores system preference and follows the OS color scheme', async () => {
    mockPrefersColorScheme(true)

    render(<ThemeModeToggle />)

    await userEvent.click(screen.getByRole('button', { name: 'Theme: System' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'System' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
  })
})
