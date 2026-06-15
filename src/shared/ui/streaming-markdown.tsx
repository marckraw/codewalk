'use client'

import dynamic from 'next/dynamic'

interface StreamingMarkdownProps {
  content: string
  className?: string
  /** When true, Streamdown animates the tail and tolerates incomplete markdown
   *  (half-written fences/lists) without flickering — used while a reply
   *  streams in. */
  isStreaming?: boolean
}

// Streamdown pulls in Shiki (heavy) and is only needed once an agent reply or
// discussion actually renders markdown — never on the initial guide/diff paint.
// Deferring it to its own client chunk keeps it out of the review page's first
// load; ssr:false because it is purely client-rendered behind auth.
const StreamingMarkdownContent = dynamic(
  () =>
    import('./streaming-markdown-content').then(
      (mod) => mod.StreamingMarkdownContent,
    ),
  {
    loading: () => (
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--panel-subtle)]" />
    ),
    ssr: false,
  },
)

/**
 * Markdown renderer for streamed agent text. Empty bodies render nothing
 * synchronously (so the heavy renderer chunk is never loaded for them); any
 * real content lazy-loads the Streamdown-backed body. The `min-w-0 break-words`
 * wrapper inside keeps long lines wrapping within the card.
 */
export function StreamingMarkdown(props: StreamingMarkdownProps) {
  if (!props.content.trim()) {
    return null
  }

  return <StreamingMarkdownContent {...props} />
}
