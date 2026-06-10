import { describe, expect, it } from 'vitest'
import { cn } from './cn.pure'

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts', () => {
    expect(cn('px-2', false && 'hidden', 'px-4')).toBe('px-4')
  })
})
