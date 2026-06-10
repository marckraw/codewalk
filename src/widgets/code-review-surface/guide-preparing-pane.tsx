import { Sparkles } from 'lucide-react'

export function GuidePreparingPane() {
  return (
    <main
      className="flex min-w-0 items-center justify-center bg-background p-6"
      role="status"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 animate-pulse" />
        Generating guide...
      </div>
    </main>
  )
}
