# Codewalk

Codewalk is a guided pull request review app. Reviewers sign in with GitHub, import a pull request by URL, and review it through Activity, Overview, Guide, and Diff views.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env.local
```

3. Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
```

## MVP Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS
- Clerk GitHub authentication
- Neon Postgres with Drizzle
- TanStack Query and Zustand for review interactions
- `@pierre/trees` and `@pierre/diffs` for PR review UI

Only the foundation is wired in this ticket. Auth, persistence, PR import, diff rendering, and guide generation are added by the follow-up Linear tickets.
