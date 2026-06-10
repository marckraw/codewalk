import { describe, expect, it } from 'vitest'
import { APP_NAME, REVIEW_TABS } from './product'

describe('product metadata', () => {
  it('defines the Codewalk review tabs in product order', () => {
    expect(APP_NAME).toBe('Codewalk')
    expect(REVIEW_TABS).toEqual(['Activity', 'Overview', 'Guide', 'Diff'])
  })
})
