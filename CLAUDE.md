# CLAUDE.md — RCF FUTA ICT Portal

@AGENTS.md

Everything in AGENTS.md above is the canonical project spec and applies here too.
This file only adds what's specific to running as Claude Code in this repo.

## Before starting a task

- If `node_modules` is missing or `pnpm-lock.yaml` changed, run `pnpm install` first.
- Read the target route's existing `actions.ts` and `components/` folder before
  writing anything new — this repo has strong precedent to match (e.g.
  `dashboard/tenure/` has four tabs plus a modal; `events/[slug]/` has separate
  admin, register, and check-in variants). Match the existing shape rather than
  inventing a new one.
- Grep for existing stores/hooks before adding new client state — `tenure.store.ts`
  and `profile.store.ts` already exist, and duplicating state management here is a
  known easy mistake.

## Verification loop — run this after every change, not just at the end

1. `pnpm lint` — should come back clean, or only flag pre-existing issues you didn't introduce.
2. `pnpm build` — for anything touching routing, server actions, or `src/proxy.ts`,
   treat a successful build as the real correctness check; a lot of App Router
   mistakes only surface at build time, not in the editor.
3. For UI changes: in your summary, say what changed **and why it's better on a
   small screen / slow connection** — not just "updated styles."

## Investigating before editing

- Route groups `(auth)` and `(home)` don't add a URL segment — if a route isn't
  behaving as expected, check whether it's actually nested in one of these first.
- If a task touches auth, read `src/lib/auth-roles.ts`, `src/lib/access-control.ts`,
  and `src/proxy.ts` together before changing any single one — they're designed to
  work as one system, and `src/proxy.ts` is intentionally *not* where authorization
  decisions are made (see AGENTS.md).

## Communication style for this project

- Assume you're working with a junior-to-mid engineer building this mostly solo.
  Briefly explain the *why* behind non-obvious architectural choices in your
  summaries, not just the *what*.
- Explicitly call out anything security-relevant you touched — cookies, roles,
  `asAdmin()`, or `src/proxy.ts` — even if it wasn't the main ask.


## Don't

- Don't run `git push` or open a PR unless explicitly asked to.
- Don't swap in a UI kit (shadcn, MUI, etc.) to replace the hand-rolled components in
  `src/components/ui/` unless the user explicitly asks for that migration — it's a
  deliberate existing choice, not an oversight.
