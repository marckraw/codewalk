# Agent Instructions

## Post-task requirement

Use the Node version from `.nvmrc` for all repo commands that depend on Node
tooling (`npm install`, Vitest, typecheck, Chaperone, Next.js, Drizzle). If the
required Node version is unavailable, report that explicitly instead of running
verification on a different runtime.

After every finished task, run:

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run test:pure`
- `npm run test:unit`
- `chaperone check --fix`

Never leave code that fails `chaperone check`.

## Architecture and File Organization

Codewalk follows FSD-lite for application source:

- layered slices: `app`, `widgets`, `features`, `entities`, `shared`
- one-way imports from higher layers to lower layers only
- cross-slice imports through each slice `index.ts` public API
- UI split by role: `*.container.tsx` for state/effects/orchestration, `*.presentational.tsx` for render-only UI

Required source roots:

- `src/app`: Next.js routes, layouts, API route handlers, and route-only shells
- `src/widgets`: page-scale composed UI
- `src/features`: user actions and use-case workflows
- `src/entities`: domain modules such as pull requests, review workspaces, guides, users, auth, GitHub, and agents daemon
- `src/shared`: UI primitives, generic pure helpers, shared types, and test helpers

Do not add long-term code under `src/components`, `src/hooks`, or `src/lib`.

## UI

Use `motion` (the framer-motion successor) for animation — reach for it over bespoke CSS keyframes whenever enter/exit, layout, gesture, or physics matters; the reusable `AnimatedStatus` (`src/shared/ui`) is the pattern for async-progress / "waiting on the system" states.

## File Naming

Use these suffixes for new or migrated files:

- `*.presentational.tsx`: render-only component, props in -> JSX out
- `*.container.tsx`: state/effects/orchestration wrapper for UI
- `*.styles.ts`: styling constants and class maps only
- `*.api.ts`: IO boundaries, HTTP clients, SDK wrappers, persistence access
- `*.service.ts`: side-effectful use-case orchestration
- `*.model.ts` or `use*.ts`: local state/domain logic
- `*.pure.ts`: pure utilities only
- `*.types.ts`: local types for a slice/feature

Next.js framework files keep their required names (`page.tsx`, `layout.tsx`,
`route.ts`, etc.).

## Presentational vs Container Rules

`*.presentational.tsx` files must not contain side-effectful orchestration:

- no `useEffect`, `useLayoutEffect`, or `useInsertionEffect`
- no direct `server-only` imports
- no browser storage or navigation globals
- no data fetching or persistence access

`*.container.tsx` files own state, effects, browser APIs, and wiring. They may
render JSX directly when a separate presentational file would be a hollow
pass-through.

## Import Rules

Layer direction:

- `app` -> `widgets`, `features`, `entities`, `shared`
- `widgets` -> `features`, `entities`, `shared`
- `features` -> `entities`, `shared`
- `entities` -> `shared`
- `shared` -> `shared`

Cross-slice imports must go through the slice `index.ts` public API. Avoid deep
private imports across slices.

## Migration Behavior

When adding or changing code, land it in the final intended FSD location. Do not
create new compatibility shims for old `src/components` or `src/lib` paths.
