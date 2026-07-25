# AGENTS.md — RCF FUTA ICT Portal

This file is the canonical, tool-agnostic source of truth for any AI coding agent
(Claude Code, Cursor, Copilot, Codex, etc.) working in this repo. Keep it accurate —
when reality and this file disagree, fix this file in the same PR.

## What this project is

A Next.js web portal for the RCF FUTA fellowship: public event pages + QR check-in,
a members dashboard (profile, units, zones, tenure/leadership structure), and a
lightweight Q&A feature ("lo-app"). **The primary audience is university students,
mostly on mid-range Android phones and limited mobile data.** UI/UX polish and
performance are product requirements, not nice-to-haves — see the dedicated section
below before touching any screen a member will see.

## Stack (verified against package.json — confirm before assuming a version changed)

- **Next.js 16.1.1**, App Router, Turbopack, React Compiler enabled
- **React 19.2.3**
- **TypeScript 5**, strict mode on
- **Tailwind CSS v4** — CSS-first config, `@theme` block inside `src/app/globals.css`.
  There is **no `tailwind.config.js`/`.ts`** in this project — don't create one, it
  won't be picked up and will confuse the next person who edits the theme.
- **Zustand** for client state (`src/lib/stores/*.store.ts`)
- **react-hook-form + zod + @hookform/resolvers** for all forms
- **framer-motion** for animation, **lucide-react** for icons
- **@rcffuta/ict-lib** — internal SDK wrapping Supabase Auth + institutional member data
- **@yudiel/react-qr-scanner** + **react-qr-code** — event check-in QR flows
- **date-fns**
- Package manager is **pnpm** (`pnpm-lock.yaml`, `.npmrc` present). Never use npm/yarn
  commands or generate their lockfiles.

## Commands

```
pnpm dev      # start dev server (Turbopack)
pnpm build    # production build — the real correctness check for App Router/auth changes
pnpm start    # run the production build
pnpm lint     # ESLint (eslint-config-next core-web-vitals + typescript)
```

**No test runner is configured** (no jest/vitest/playwright in package.json). Don't
assume tests exist or invent a test command. If asked to add testing, propose
Vitest + React Testing Library and confirm before installing anything.

## Folder structure — where new code goes

```
src/app/            App Router routes ONLY. Route groups: (auth), (home) — these
                     don't add a URL segment.
                     Each feature route (dashboard/*, events/*, lo-app) colocates
                     its own actions.ts (server actions) and a components/ folder
                     for route-only UI. Follow that pattern for new features.
src/components/     Shared, reusable UI, organized by domain:
                     ui/ (generic primitives), auth/, layout/, events/, dashboard/, lo-app/
src/lib/             Core logic: ict.ts (ICT client), auth-roles.ts, auth-utils.ts,
                     access-control.ts, stores/ (zustand), hooks/, utils.ts (cn() etc.)
src/hooks/           Cross-cutting hooks not tied to lib internals (e.g. useSessionGuard)
src/config/          Static config — sidebar-items.tsx is the single source of truth
                     for nav items. Extend it; don't hardcode links in sidebar.tsx.
src/utils/           Generic helpers (action.ts)
src/proxy.ts         Next.js 16's network boundary (replaces middleware.ts, runs on
                     the Node runtime, not Edge). See Auth section below.
```

Rule of thumb: a new component starts in its route's `components/` folder. Promote it
to `src/components/<domain>/` only once a second route needs it.

## Path alias

Always import via `@/...` (maps to `src/*`). Avoid `../../../` chains of more than one level.

## Auth & authorization — read this before touching any auth code

- Sessions are Supabase Auth, wrapped by `@rcffuta/ict-lib`: `RcfIctClient.fromEnv()`
  for normal operations, `RcfIctClient.asAdmin()` for elevated/service-role operations
  that bypass RLS. Treat `asAdmin()` as dangerous — server-only, and only after the
  caller's role has already been checked.
- Tokens (`sb-access-token`, `sb-refresh-token`) are set as httpOnly, `sameSite=lax`
  cookies from server actions (`src/app/actions/auth.ts`). Never read or write these
  cookies from a client component.
- **`src/proxy.ts` only checks whether a token is *present*, to decide redirect vs.
  allow — it is a UX convenience layer, not an authorization boundary.** Real
  permission checks belong in the server component / server action / route handler,
  using `src/lib/auth-roles.ts` (`determineUserRole`, `isAdmin`, `isModerator`,
  `permissions.*`) and `src/lib/access-control.ts`.
- Three roles — `USER`, `MODERATOR`, `ADMIN` — are **derived** from institutional
  profile data (ICT department → ADMIN, any leadership `roles[]` → MODERATOR). Role is
  never a field the client can set directly.
- The `publicRoutes` list is hardcoded inside `src/proxy.ts`. Adding a new top-level
  public route requires updating that list too, or anonymous users get redirected to
  `/login` incorrectly.
- `AUTHENTICATION.md` and `AUTH_MANUAL.md` at the repo root describe an earlier/
  aspirational version of this architecture (e.g. they reference a
  `src/types/app.type.ts` that doesn't currently exist). When these docs disagree with
  the actual code in `src/lib/auth-*.ts`, **the code wins** — but read the docs for
  design intent, and flag the discrepancy instead of silently guessing.

## UI/UX standards (non-negotiable on this project)

- **Mobile-first, always.** Build and test the small-screen layout before scaling up.
- Respect notch/safe-area insets — reuse the existing `.safe-top` / `.safe-bottom` /
  `.safe-left` utilities in `globals.css` on any full-bleed header or footer.
- Use the existing brand tokens — `--color-rcf-navy`, `--color-rcf-navy-light`,
  `--color-rcf-gold` (defined in the `@theme` block in `src/app/globals.css`). Don't
  hardcode new hex values.
- Check `src/components/ui/` before building a new primitive — `FormInput`,
  `FormSelect`, `badge`/`badge-group`, `alert-modal`, `preloader`, `cool-loader`
  already exist.
- Every async action (form submit, data fetch, QR scan) needs a visible loading state
  **and** an error state — no silent failures. Assume slow or dropped requests are
  normal, not exceptional.
- Animations (framer-motion, the CSS keyframes in `globals.css`) must respect
  `prefers-reduced-motion`.
- Forms: react-hook-form + zod resolver, inline field-level errors (not just a toast),
  and a disabled/pending submit button — never allow double-submit.
- Watch bundle size and image weight — use `next/image`, lazy-load below-the-fold
  content, and prefer the libraries already installed (framer-motion, lucide,
  tailwind) over adding a new dependency for something they already cover.
- Accessibility: semantic HTML, visible focus states, sufficient contrast against the
  navy background, and labels properly tied to inputs (not placeholder-only forms).

## Code style

- **4-space indentation** — enforced by `eslint.config.mjs`. This overrides the more
  common 2-space convention; don't "fix" it back to 2.
- Follow `eslint-config-next` (core-web-vitals + typescript). Run `pnpm lint` before
  considering any change done.
- File naming is currently mixed (PascalCase like `EventCard.tsx`, kebab-case like
  `mobile-header.tsx`). Don't mass-rename existing files — match the convention of
  the folder you're adding to, and default to kebab-case for genuinely new domains.
- Server actions live in the route's own `actions.ts`; shared/generic action helpers
  go in `src/utils/action.ts`.
- when the engineer approves a plan, write the plan out to ./.plan first, and when you're done with the plan, you delete it.

## Never do this

- Never call `RcfIctClient.asAdmin()` from client-side code or leak its result to the browser.
- Never treat `src/proxy.ts` as the sole authorization check for a sensitive route or action.
- Never add a `tailwind.config.js`/`.ts` — this is a Tailwind v4 CSS-first project.
- Never introduce an npm or yarn lockfile — pnpm only.
- Never commit secrets — Supabase/ICT-lib credentials come from environment variables
  via `RcfIctClient.fromEnv()`.

## When docs disagree with code

This repo has many historical markdown files (root-level `AUTHENTICATION.md`,
`AUTH_MANUAL.md`, `SIDEBAR_*.md`, `QA-FEATURE.md`, `unit-leader.md`,
`event-update.md`, plus per-feature docs like `dashboard/tenure/README.md`). They
were written at different points and drift from the code over time. If one conflicts
with what's actually implemented, follow the code and say so — don't silently pick
one version.
