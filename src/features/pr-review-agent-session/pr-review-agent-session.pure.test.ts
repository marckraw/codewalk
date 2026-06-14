import { describe, expect, it } from 'vitest'
import {
  buildPullRequestReviewAgentInitialPrompt,
  buildPullRequestReviewAgentSessionId,
  buildReviewThreadAgentFixPrompt,
  buildReviewThreadAgentQuestionPrompt,
  extractAgentReplyAfterLastUserMessage,
} from './pr-review-agent-session.pure'

describe('PR review agent session helpers', () => {
  it('builds a stable daemon-safe session id prefix', () => {
    expect(
      buildPullRequestReviewAgentSessionId({
        nonce: 'A/B:C',
        number: 42,
        owner: 'EF-Global',
        repo: 'Backpack Suite',
      }),
    ).toBe('codewalk-pr-ef-global-backpack-suite-42-a-b-c')
  })

  it('builds an initial prompt scoped to the pull request', () => {
    expect(
      buildPullRequestReviewAgentInitialPrompt({
        baseRef: 'main',
        headRef: 'feature/review',
        number: 42,
        owner: 'ef-global',
        repo: 'backpack',
        title: 'Improve review guide',
        url: 'https://github.com/ef-global/backpack/pull/42',
      }),
    ).toContain('ef-global/backpack#42')
  })

  it('includes the guide overview and sections in the boot prompt', () => {
    const prompt = buildPullRequestReviewAgentInitialPrompt(
      {
        baseRef: 'main',
        headRef: 'feature/review',
        number: 42,
        owner: 'ef-global',
        repo: 'backpack',
        title: 'Improve review guide',
        url: 'https://github.com/ef-global/backpack/pull/42',
      },
      {
        overview: 'Refactors the auth middleware.',
        sections: [{ summary: 'Token checks moved', title: 'Auth' }],
      },
    )

    expect(prompt).toContain('Refactors the auth middleware.')
    expect(prompt).toContain('- Auth: Token checks moved')
  })

  it('builds an anchored question prompt with excerpt and history', () => {
    const prompt = buildReviewThreadAgentQuestionPrompt({
      anchor: {
        anchorCommitSha: 'abc123',
        excerpt: 'const token = parse(header)',
        filePath: 'src/auth.ts',
        lineEnd: 14,
        lineStart: 10,
        side: 'new',
      },
      history: [{ authorType: 'user', body: 'Earlier question' }],
      question: 'Why is this safe?',
    })

    expect(prompt).toContain('File: src/auth.ts')
    expect(prompt).toContain('Lines: 10-14 (new side, at commit abc123)')
    expect(prompt).toContain('const token = parse(header)')
    expect(prompt).toContain('Reviewer: Earlier question')
    expect(prompt).toContain('Question: Why is this safe?')
  })

  it('includes additional anchors in a multi-anchor question prompt', () => {
    const prompt = buildReviewThreadAgentQuestionPrompt({
      anchor: {
        anchorCommitSha: 'abc123',
        excerpt: 'const token = parse(header)',
        filePath: 'src/auth.ts',
        lineEnd: 14,
        lineStart: 10,
        side: 'new',
      },
      additionalAnchors: [
        {
          anchorCommitSha: 'abc123',
          excerpt: 'verifyToken(token)',
          filePath: 'src/verify.ts',
          lineEnd: 20,
          lineStart: 18,
          side: 'new',
        },
      ],
      history: [],
      question: 'How do these interact?',
    })

    expect(prompt).toContain('spanning several diff selections')
    expect(prompt).toContain('File: src/auth.ts')
    expect(prompt).toContain('File: src/verify.ts')
    expect(prompt).toContain('verifyToken(token)')
  })

  it('builds a fix prompt that commits locally without pushing', () => {
    const prompt = buildReviewThreadAgentFixPrompt({
      anchor: {
        anchorCommitSha: 'abc123',
        excerpt: 'const token = parse(header)',
        filePath: 'src/auth.ts',
        lineEnd: 14,
        lineStart: 10,
        side: 'new',
      },
      history: [{ authorType: 'agent', body: 'This could overflow.' }],
      instruction: 'Guard the parse call',
    })

    expect(prompt).toContain('File: src/auth.ts')
    expect(prompt).toContain('Reviewer instruction: Guard the parse call')
    expect(prompt).toContain('commit it locally')
    expect(prompt).toContain('Do NOT push')
    expect(prompt).toContain('diffstat')
  })

  it('extracts assistant messages after the last user message', () => {
    const conversation = [
      {
        actor: 'user',
        id: 'i-1',
        kind: 'message',
        state: 'complete',
        text: 'boot',
      },
      {
        actor: 'assistant',
        id: 'i-2',
        kind: 'message',
        state: 'complete',
        text: 'Ready.',
      },
      {
        actor: 'user',
        id: 'i-3',
        kind: 'message',
        state: 'complete',
        text: 'question',
      },
      {
        actor: null,
        id: 'i-4',
        kind: 'tool-call',
        state: 'complete',
        text: null,
      },
      {
        actor: 'assistant',
        id: 'i-5',
        kind: 'message',
        state: 'complete',
        text: 'It validates the token.',
      },
      {
        actor: 'assistant',
        id: 'i-6',
        kind: 'message',
        state: 'complete',
        text: 'See src/auth.ts:12.',
      },
    ]

    expect(extractAgentReplyAfterLastUserMessage(conversation)).toBe(
      'It validates the token.\n\nSee src/auth.ts:12.',
    )
    expect(
      extractAgentReplyAfterLastUserMessage(conversation.slice(0, 3)),
    ).toBeNull()
    expect(extractAgentReplyAfterLastUserMessage([])).toBeNull()
  })
})
