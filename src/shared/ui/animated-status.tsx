import { cn } from '@/shared/lib/cn.pure'

interface AnimatedStatusProps {
  /**
   * The current status text. Whenever it changes, the new value rolls up into
   * place from below, like a fresh item arriving in a list.
   */
  status: string
  className?: string
}

/**
 * Animated status ticker for any interface that kicks off async work and then
 * waits on streamed progress — agent activity, job phases, upload steps. Each
 * new status rolls up smoothly instead of snapping between labels, so the wait
 * feels alive. Reusable wherever "we triggered something and are watching it
 * progress" needs motion.
 *
 * Implementation: the inner node is keyed by `status`, so a change remounts it
 * and replays the CSS roll-in (keyframes in globals.css). `overflow-hidden`
 * clips it to one line for the ticker feel. Respects prefers-reduced-motion.
 */
export function AnimatedStatus({ status, className }: AnimatedStatusProps) {
  return (
    <span className={cn('inline-flex overflow-hidden', className)}>
      <span className="animate-status-roll-in" key={status}>
        {status}
      </span>
    </span>
  )
}
