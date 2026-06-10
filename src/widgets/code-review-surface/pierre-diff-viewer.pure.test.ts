import { describe, expect, it } from 'vitest'
import { describeMissingPierrePatch } from './pierre-diff-viewer.pure'

describe('describeMissingPierrePatch', () => {
  it('explains a removed file', () => {
    expect(
      describeMissingPierrePatch({ diff: '', fileStatus: 'removed' }),
    ).toBe('This file was removed in the pull request.')
  })

  it('detects GitHub binary patches', () => {
    expect(
      describeMissingPierrePatch({
        diff: 'Binary files a/logo.png and b/logo.png differ',
      }),
    ).toBe('Binary file — no text diff to display.')
    expect(describeMissingPierrePatch({ diff: 'GIT binary patch\n...' })).toBe(
      'Binary file — no text diff to display.',
    )
  })

  it('distinguishes a new file with no captured patch from a generic empty one', () => {
    expect(
      describeMissingPierrePatch({ diff: '   ', fileStatus: 'added' }),
    ).toBe('New file — no patch was captured for this snapshot.')
    expect(describeMissingPierrePatch({ diff: '' })).toBe(
      'No patch was captured for this file.',
    )
  })

  it('returns null when there is raw content to show', () => {
    expect(
      describeMissingPierrePatch({
        diff: 'some unparseable but present content',
      }),
    ).toBeNull()
  })
})
