export function ThreadExcerpt({ excerpt }: { excerpt: string }) {
  return (
    <pre className="max-h-36 overflow-auto border-b border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 font-mono text-[11px] leading-5 whitespace-pre-wrap text-[var(--muted)]">
      {excerpt}
    </pre>
  )
}
