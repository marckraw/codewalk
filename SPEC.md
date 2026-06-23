# Spec: Anchorless general PR discussions (anchors attachable later)

## 1. Objective & users

**Objective.** Let a reviewer start a whole-PR conversation with the agent
directly from the Discussions tab, without first pinning diff selections. The
agent answers with full pull-request context. Selections can be attached to the
conversation later, as it develops, to ground follow-up questions.

**Users.** Reviewers using Codewalk's guided PR review who want to ask the agent
about the PR in general ("what's the riskiest change here?", "why this
approach?") before — or instead of — anchoring to specific lines.

**Problem today.** A discussion can only be created by pinning ≥1 diff selection
(`PinnedDiscussionComposer` appears only when `pinnedAnchors.length > 0`). The
data model, API, and agent prompt all require a line anchor, so there is no way
to "just start talking."

## 2. Scope

**In scope**

- Start a discussion with zero anchors from the Discussions tab.
- Agent answers anchorless discussions with whole-PR context.
- Attach one or more diff selections to an existing discussion afterward.
- Anchors attached later enrich context for the _next_ agent turn.

**Out of scope**

- Changing inline (line-anchored) threads — they keep working unchanged.
- Re-running the agent automatically when an anchor is attached.
- Removing/editing individual attached anchors (future; attach-only for now).
- Any change to the fix-proposal / push flow.

## 3. Functional requirements & acceptance criteria

**FR1 — Start an anchorless discussion**

- Discussions tab shows a "New discussion" action and a composer that needs no
  pins; reviewer types a question and submits.
- Creates a `kind: 'discussion'` thread with an empty anchor set and
  `anchorSnapshotId = snapshot.id`.
- AC: With no selection pinned, the reviewer can open the composer, ask a
  question, and a discussion card appears in the Discussions tab.

**FR2 — Agent answers with whole-PR context, no file changes**

- The agent reply for an anchorless discussion uses a general PR prompt (PR
  identity + guide context already seed the daemon session) instead of the
  line-anchored prompt.
- AC: Asking a question on an anchorless discussion returns an answer that does
  not reference a phantom file/line, and the agent modifies no files.

**FR3 — Attach selections later**

- From the diff, the reviewer can attach the current selection to an existing
  open discussion (in addition to starting a new one).
- Attached anchors render as reference chips on the discussion card and are
  included in the next agent turn's prompt.
- AC: After attaching a selection, the card lists it as a chip; the chip jumps
  to that selection in the diff; the next agent answer can reason about it.

**FR4 — Anchored and anchorless discussions coexist**

- Existing pinned discussions (created with a primary anchor) keep rendering and
  answering exactly as before.
- AC: A pre-existing pinned discussion shows unchanged after this change ships.

**FR5 — Discussions never go "outdated"**

- `kind: 'discussion'` threads are excluded from outdated marking on re-import.
- AC: Re-importing a PR after a push does not flag any discussion outdated.

## 4. Data model decision

Treat a discussion's anchors as one **ordered list of 0..N**
`ReviewThreadAnchorRef`, stored in the existing `extraAnchors` jsonb column. No
migration: the `NOT NULL` primary-anchor columns are filled with sentinels for
discussions (`filePath: ''`, `excerpt: ''`, `lineStart/lineEnd: 0`,
`side: 'new'`, `anchorCommitSha: <headSha>`), and the real set lives in the list.

The sentinel is contained behind two pure helpers in
`entities/review-thread`:

- `reviewThreadAnchors(thread)` → unified anchor list (primary-if-real + extras).
- `reviewThreadHasAnchor(thread)` → whether the discussion has any anchor.

A later migration to nullable primary columns becomes mechanical if desired.

## 5. Change surface (FSD-lite placement)

- `entities/review-thread`
  - `*.pure.ts`: `reviewThreadAnchors`, `reviewThreadHasAnchor` (+ pure tests).
  - `*.api.ts`: client fns for create-anchorless and attach-anchor.
  - `*.types.ts`: input types for the above.
- `entities/database/review-threads.ts`: fn to append an anchor to a thread's
  list; allow creating a discussion with the sentinel anchor.
- `app/api/review-threads/route.ts` (POST): relax `filePath`/anchor checks when
  `kind === 'discussion'`.
- `app/api/review-threads/[threadId]/route.ts` (PATCH): accept an anchor to
  append (alongside existing status update).
- `features/pr-review-agent-session/pr-review-agent-session.pure.ts`: add a
  general (anchorless) PR-question prompt; select it when
  `!reviewThreadHasAnchor(thread)`.
- `features/review-thread-outdated/review-thread-outdated.service.ts`: skip
  `kind === 'discussion'` candidates.
- `widgets/code-review-surface`
  - `discussions-view.presentational.tsx`: "New discussion" + anchorless
    composer; empty-state copy update.
  - `persisted-review-thread-annotation.presentational.tsx`: render anchors from
    the unified list; show "Whole pull request" when empty.
  - `review-workspace.tsx`: container wiring — start anchorless, attach-to-open
    discussion from the diff, optimistic updates.

**Primary open UX question (flag, don't block):** attach-later is diff-driven —
the diff "Pin" affordance offers a target ("New discussion" or an existing open
discussion). Exact control (inline dropdown vs. step) to be finalized in build.

## 6. Commands

Per `AGENTS.md`, after every finished task (Node from `.nvmrc`):

```
npm install
npm run lint
npm run typecheck
npm run test:pure
npm run test:unit
chaperone check --fix
```

## 7. Code style

FSD-lite, one-way layer imports, cross-slice via `index.ts` public APIs. File
suffixes: `*.presentational.tsx` (render-only, no effects/IO),
`*.container.tsx` (state/effects), `*.api.ts` (IO), `*.service.ts`
(side-effectful orchestration), `*.pure.ts` (deterministic + sibling tests),
`*.types.ts`. Use `motion` for animation; `AnimatedStatus` for async-progress.

## 8. Testing strategy

- **Pure** (`*.pure.test.ts`): `reviewThreadAnchors` / `reviewThreadHasAnchor`
  across empty, primary-only, and primary+extras; the general PR prompt builder.
- **Unit** (`*.test.ts(x)`): POST route accepts an anchorless discussion and
  still rejects malformed inline threads; PATCH appends an anchor; outdated
  service skips discussions; agent-reply uses the general prompt when anchorless.
- Keep `chaperone check` clean (no new `src/components|hooks|lib` paths, no
  effects in presentational files).

## 9. Boundaries

**Always**

- Keep inline threads and existing pinned discussions behavior-identical.
- Route new code to its final FSD location; contain the sentinel behind helpers.
- Run the §6 verification before handoff.

**Ask first**

- Any database migration (the chosen path needs none).
- Auto-triggering an agent turn on anchor attach.
- Changing the fix/push flow or the inline-thread prompt.

**Never**

- Let an anchorless discussion drive the agent to modify files (Q&A only).
- Add compatibility shims under `src/components`, `src/hooks`, or `src/lib`.
- Leave code failing `chaperone check`.
