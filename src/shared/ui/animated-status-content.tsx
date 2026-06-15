'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib/cn.pure'

interface AnimatedStatusContentProps {
  /**
   * The current status text. Whenever it changes, the previous value rolls up
   * and out while the new one rolls up into place — a crossfading ticker.
   */
  status: string
  className?: string
}

/**
 * Motion-backed status ticker. Kept in its own module so `motion` can be
 * lazy-loaded by the `AnimatedStatus` wrapper and stay out of the review page's
 * first load — it is only needed once async work starts streaming progress.
 *
 * Each new status crossfades in (old rolls out the top, new rolls up from
 * below). Honors prefers-reduced-motion via a plain opacity fade.
 */
export function AnimatedStatusContent({
  status,
  className,
}: AnimatedStatusContentProps) {
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
