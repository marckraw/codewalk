import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface MarkdownTextProps {
  className?: string;
  content: string;
}

export function MarkdownText({ className, content }: MarkdownTextProps) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`} className="my-0">
          {renderInlineMarkdown(paragraph)}
        </p>
      ))}
    </div>
  );
}

function renderInlineMarkdown(value: string): ReactNode {
  const parts = value.split(/(`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`${index}-${part}`} className="rounded bg-[var(--panel-subtle)] px-1 font-mono text-[0.92em]">
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}
