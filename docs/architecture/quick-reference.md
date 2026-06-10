# Codewalk Architecture Quick Reference

Codewalk is a Next.js App Router app organized with FSD-lite:

- `src/app`: routes, layouts, API route handlers
- `src/widgets`: page-scale composed UI
- `src/features`: user actions and use-case workflows
- `src/entities`: domain modules and IO for pull requests, review workspaces, guides, auth, GitHub, users, deployment diagnostics, and agents daemon
- `src/shared`: UI primitives, generic helpers, shared types, and testing helpers

Layer imports flow downward only. Cross-slice imports use `index.ts` public APIs.

Naming conventions:

- `*.container.tsx`: state, effects, browser APIs, orchestration
- `*.presentational.tsx`: render-only UI
- `*.api.ts`: IO, SDK wrappers, persistence access
- `*.service.ts`: side-effectful use-case orchestration
- `*.pure.ts`: deterministic helpers with sibling tests
- `*.types.ts`: local exported types

Next.js framework files keep framework names such as `page.tsx`, `layout.tsx`,
and `route.ts`.
