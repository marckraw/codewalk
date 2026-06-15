'use client'

import { Streamdown, type Components } from 'streamdown'
import { cn } from '@/shared/lib/cn.pure'

// Light/dark Shiki themes for fenced code blocks; Streamdown picks per the
// active color scheme. Code blocks are left to Streamdown so they highlight.
const SHIKI_THEME: ['github-light', 'github-dark'] = [
  'github-light',
  'github-dark',
]

interface StreamingMarkdownContentProps {
  content: string
  className?: string
  /** When true, Streamdown animates the tail and tolerates incomplete markdown
   *  (half-written fences/lists) without flickering — used while a reply
   *  streams in. */
  isStreaming?: boolean
}

const COMPONENTS: Components = {
  a: ({ className, ...props }) => (
    <a
      className={cn(
        'break-words font-medium text-primary underline underline-offset-2 hover:opacity-80',
        className,
      )}
      rel="noreferrer noopener"
      target="_blank"
      {...props}
    />
  ),
  em: ({ className, ...props }) => (
    <em className={cn('italic', className)} {...props} />
  ),
  h1: ({ className, ...props }) => (
    <h1 className={cn('my-2 text-sm font-semibold', className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn('my-2 text-sm font-semibold', className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn('my-1.5 text-xs font-semibold uppercase', className)}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn('my-0.5 min-w-0', className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn('my-1 grid list-decimal gap-1 pl-5', className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p className={cn('my-1 leading-5 break-words', className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong
      className={cn('font-semibold text-[var(--foreground)]', className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn('my-1 grid list-disc gap-1 pl-5', className)}
      {...props}
    />
  ),
}

/**
 * Streamdown-backed markdown body for agent replies. Kept in its own module so
 * the heavy renderer (Streamdown + Shiki) can be lazy-loaded by the
 * `StreamingMarkdown` wrapper and stay out of the review page's first load.
 * Callers should guard empty content; this always renders the block.
 */
export function StreamingMarkdownContent({
  className,
  content,
  isStreaming,
}: StreamingMarkdownContentProps) {
  return (
    <div
      className={cn(
        'min-w-0 break-words text-xs text-[var(--foreground)] [&_:first-child]:mt-0 [&_:last-child]:mb-0',
        className,
      )}
    >
      <Streamdown
        components={COMPONENTS}
        isAnimating={isStreaming === true}
        shikiTheme={SHIKI_THEME}
      >
        {content}
      </Streamdown>
    </div>
  )
}
