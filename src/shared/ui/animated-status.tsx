'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib/cn.pure'

interface AnimatedStatusProps {
  /**
   * The current status text. Whenever it changes, the previous value rolls up
   * and out while the new one rolls up into place — a crossfading ticker.
   */
  status: string
  className?: string
}

/**
 * Animated status ticker for any interface that kicks off async work and then
 * waits on streamed progress — agent activity, job phases, upload steps. Each
 * new status crossfades in (old rolls out the top, new rolls up from below) so
 * the wait feels alive instead of snapping between labels. Reusable wherever
 * "we triggered something and are watching it progress" needs motion.
 *
 * Built on `motion` (AnimatePresence handles the exit). Honors
 * prefers-reduced-motion via a plain opacity fade. `overflow-hidden` + the
 * shared grid cell clip the two states to one line for the roll.
 */
export function AnimatedStatus({ status, className }: AnimatedStatusProps) {
  const reduceMotion = useReducedMotion()
  const variants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: '100%' },
        animate: { opacity: 1, y: '0%' },
        exit: { opacity: 0, y: '-100%' },
      }

  return (
    <span className={cn('inline-grid overflow-hidden align-bottom', className)}>
      <AnimatePresence initial={false}>
        <motion.span
          animate={variants.animate}
          className="col-start-1 row-start-1"
          exit={variants.exit}
          initial={variants.initial}
          key={status}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          {status}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
