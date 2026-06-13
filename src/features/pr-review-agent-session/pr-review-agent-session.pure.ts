import type { AgentsDaemonConversationItem } from '@/entities/agents-daemon'
import type { PullRequestSnapshotRow } from '@/entities/database'

export type ReviewAgentGuideContext = {
  overview: string
  sections: Array<{ summary: string; title: string }>
}

export type ReviewAgentThreadAnchor = {
  anchorCommitSha: string
  excerpt: string
  filePath: string
  lineEnd: number
  lineStart: number
  side: 'old' | 'new'
}

export type ReviewAgentThreadHistoryEntry = {
  authorType: 'user' | 'agent'
  body: string
}

export function buildPullRequestReviewAgentInitialPrompt(
  snapshot: Pick<
    PullRequestSnapshotRow,
    'baseRef' | 'headRef' | 'number' | 'owner' | 'repo' | 'title' | 'url'
  >,
  guide?: ReviewAgentGuideContext | null,
) {
  const guideLines = guide
    ? [
        '',
        'A guided review of this PR was already generated. Its overview:',
        guide.overview,
        ...(guide.sections.length > 0
          ? [
              '',
              'Guide sections:',
              ...guide.sections.map(
                (section) => `- ${section.title}: ${section.summary}`,
              ),
            ]
          : []),
      ]
    : []

  return [
    'You are the Codewalk pull request review assistant.',
    '',
    `Pull request: ${snapshot.owner}/${snapshot.repo}#${snapshot.number}`,
    `Title: ${snapshot.title}`,
    `Branch: ${snapshot.baseRef} -> ${snapshot.headRef}`,
    `URL: ${snapshot.url}`,
    ...guideLines,
    '',
    'Your job is to answer anchored review questions about this PR.',
    'Use the repository checkout to inspect surrounding code before answering.',
    'Wait for specific line-range questions from Codewalk review threads.',
    '',
    'Reply with a short readiness confirmation only.',
  ].join('\n')
}

/**
 * The follow-up sent for one review-thread question. The anchor excerpt is
 * denormalized into the prompt so the agent answers about the exact lines the
 * reviewer selected even when the checkout has moved on.
 */
export function buildReviewThreadAgentQuestionPrompt(input: {
  anchor: ReviewAgentThreadAnchor
  history: ReviewAgentThreadHistoryEntry[]
  question: string
}) {
  const historyLines =
    input.history.length > 0
      ? [
          'Earlier comments in this thread:',
          ...input.history.map(
            (entry) =>
              `${entry.authorType === 'agent' ? 'Agent' : 'Reviewer'}: ${entry.body}`,
          ),
          '',
        ]
      : []

  return [
    'A reviewer asked a question anchored to a diff selection.',
    '',
    `File: ${input.anchor.filePath}`,
    `Lines: ${input.anchor.lineStart}-${input.anchor.lineEnd} (${
      input.anchor.side === 'old' ? 'old' : 'new'
    } side, at commit ${input.anchor.anchorCommitSha})`,
    'Selected lines:',
    '```',
    input.anchor.excerpt,
    '```',
    '',
    ...historyLines,
    `Question: ${input.question}`,
    '',
    'Answer concisely with concrete file references. Do not modify any files.',
  ].join('\n')
}

/**
 * The follow-up sent when a reviewer asks the agent to implement the change
 * discussed in the thread. The agent commits locally in its workspace but must
 * NOT push — publishing to the PR branch is a separate, explicitly-confirmed
 * step. The reply is a summary plus a diffstat the reviewer approves or
 * discards.
 */
export function buildReviewThreadAgentFixPrompt(input: {
  anchor: ReviewAgentThreadAnchor
  history: ReviewAgentThreadHistoryEntry[]
  instruction: string
}) {
  const historyLines =
    input.history.length > 0
      ? [
          'Earlier comments in this thread:',
          ...input.history.map(
            (entry) =>
              `${entry.authorType === 'agent' ? 'Agent' : 'Reviewer'}: ${entry.body}`,
          ),
          '',
        ]
      : []

  const instructionLines = input.instruction.trim()
    ? [`Reviewer instruction: ${input.instruction.trim()}`, '']
    : ['Implement the change discussed above.', '']

  return [
    'A reviewer asked you to implement a fix for a diff selection.',
    '',
    `File: ${input.anchor.filePath}`,
    `Lines: ${input.anchor.lineStart}-${input.anchor.lineEnd} (${
      input.anchor.side === 'old' ? 'old' : 'new'
    } side, at commit ${input.anchor.anchorCommitSha})`,
    'Selected lines:',
    '```',
    input.anchor.excerpt,
    '```',
    '',
    ...historyLines,
    ...instructionLines,
    'Make the change in the workspace and commit it locally with a clear',
    'message. Do NOT push or open a pull request — the reviewer publishes the',
    'commit in a separate step.',
    '',
    'Then reply with a short summary of what you changed and a diffstat',
    '(files touched with +/- line counts). If no change is needed, say so and',
    'commit nothing.',
  ].join('\n')
}

/**
 * The agent reply for a turn is every assistant message item after the LAST
 * user message in the daemon conversation. Questions are only sent while the
 * session is idle (one turn at a time per PR), so at turn end the question is
 * always the most recent user message — and unlike an in-memory baseline,
 * this survives the process that sent the question dying mid-turn.
 */
export function extractAgentReplyAfterLastUserMessage(
  conversation: AgentsDaemonConversationItem[],
): string | null {
  let lastUserIndex = -1

  for (let index = 0; index < conversation.length; index += 1) {
    const item = conversation[index]
    if (item.kind === 'message' && item.actor === 'user') {
      lastUserIndex = index
    }
  }

  if (lastUserIndex === -1) {
    return null
  }

  const replies = conversation
    .slice(lastUserIndex + 1)
    .filter((item) => item.kind === 'message' && item.actor === 'assistant')
    .map((item) => item.text?.trim() ?? '')
    .filter(Boolean)

  if (replies.length === 0) {
    return null
  }

  return replies.join('\n\n')
}

export function buildPullRequestReviewAgentSessionId(input: {
  nonce: string
  number: number
  owner: string
  repo: string
}) {
  return [
    'codewalk-pr',
    safeSessionIdPart(input.owner),
    safeSessionIdPart(input.repo),
    String(input.number),
    safeSessionIdPart(input.nonce),
  ].join('-')
}

function safeSessionIdPart(value: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'unknown'
}
