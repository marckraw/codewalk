# Agent Instructions

Follow `AGENTS.md`. The architecture source of truth is the FSD-lite structure
enforced by `.chaperone.json` and `tools/chaperone/presets/`.

For every completed task, run the verification commands listed in `AGENTS.md`
and fix any Chaperone drift before handing off.

Use `motion` (the framer-motion successor) for animation — prefer it over
bespoke CSS keyframes when enter/exit, layout, gesture, or physics matters; the
reusable `AnimatedStatus` (`src/shared/ui`) is the pattern for async-progress
states.
