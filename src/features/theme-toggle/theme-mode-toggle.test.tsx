import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeModeToggle } from './theme-mode-toggle'

describe('ThemeModeToggle', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
    window.localStorage.clear()
  })

  it('switches from an applied dark class to light mode', async () => {
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'

    render(<ThemeModeToggle />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Switch to light mode' }),
    )

    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(window.localStorage.getItem('codewalk-theme')).toBe('light')
  })

  it('switches from light mode to dark mode', async () => {
    render(<ThemeModeToggle />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Switch to dark mode' }),
    )

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(window.localStorage.getItem('codewalk-theme')).toBe('dark')
  })
})
