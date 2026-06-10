import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/shared/lib/cn.pure";

interface MarkdownTextProps {
  className?: string;
  content: string;
}

/**
 * Renders guide prose (summaries, narratives, checklist items) as Markdown.
 *
 * Raw HTML is intentionally not rendered: `react-markdown` ignores embedded
 * HTML unless `rehype-raw` is enabled, so untrusted guide content cannot inject
 * markup. Styling stays compact and inherits the surrounding font size/leading.
 */
export function MarkdownText({ className, content }: MarkdownTextProps) {
  if (!content.trim()) {
    return null;
  }

  return (
    <div className={cn("grid gap-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown components={MARKDOWN_COMPONENTS} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  a: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a
      {...props}
      className="break-words font-medium text-primary underline underline-offset-2 hover:opacity-80"
      rel="noreferrer noopener"
      target="_blank"
    >
      {children}
    </a>
  ),
  code: ({ children, ...props }: ComponentPropsWithoutRef<"code">) => (
    <code
      {...props}
      className="rounded bg-[var(--panel-subtle)] px-1 py-0.5 font-mono text-[0.92em] break-words"
    >
      {children}
    </code>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  li: ({ children }) => <li className="my-0.5 min-w-0">{children}</li>,
  ol: ({ children }) => <ol className="my-1 grid list-decimal gap-1 pl-5">{children}</ol>,
  p: ({ children }) => <p className="my-1 leading-[inherit] break-words">{children}</p>,
  pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
    <pre className="app-scrollbar my-1 overflow-x-auto rounded-md border border-border bg-[var(--panel-subtle)] p-2 text-[0.85em] leading-5">
      {children}
    </pre>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="my-1 grid list-disc gap-1 pl-5">{children}</ul>,
};
