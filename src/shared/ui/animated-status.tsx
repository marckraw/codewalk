'use client'

import dynamic from 'next/dynamic'

/**
 * Animated status ticker for any interface that kicks off async work and then
 * waits on streamed progress — agent activity, job phases, upload steps. The
 * `motion`-backed implementation is lazy-loaded so the animation library stays
 * out of the initial bundle until something actually starts ticking; ssr:false
 * because it is purely client-rendered.
 */
export const AnimatedStatus = dynamic(
  () =>
    import('./animated-status-content').then(
      (mod) => mod.AnimatedStatusContent,
    ),
  { loading: () => null, ssr: false },
)
