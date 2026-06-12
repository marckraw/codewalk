import { describe, expect, it } from 'vitest'
import { describeReviewAgentActivity } from './review-agent-activity.pure'

describe('describeReviewAgentActivity', () => {
  it('describes tool usage with the tool name', () => {
    expect(describeReviewAgentActivity('tool:Read')).toBe('using Read')
    expect(describeReviewAgentActivity('tool:')).toBe('using a tool')
  })

  it('maps known signals to short labels', () => {
    expect(describeReviewAgentActivity('thinking')).toBe('thinking')
    expect(describeReviewAgentActivity('streaming')).toBe('writing the answer')
    expect(describeReviewAgentActivity('waiting-approval')).toBe(
      'waiting for approval',
    )
    expect(describeReviewAgentActivity('running')).toBe('working')
  })

  it('passes unknown signals through', () => {
    expect(describeReviewAgentActivity('rebooting')).toBe('rebooting')
  })
})
