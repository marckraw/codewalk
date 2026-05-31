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

## Clerk Auth

Codewalk uses Clerk with GitHub OAuth. Add these values to `.env.local` before testing sign-in:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/review
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/review
```

Without Clerk keys, the app renders a setup prompt instead of starting auth.
