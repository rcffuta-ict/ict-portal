# RCF FUTA ICT Portal

The web portal for the RCF FUTA fellowship: public event pages with QR check-in, a
members dashboard (profile, units, zones, levels, tenure/leadership structure), and a
lightweight Q&A feature ("lo-app").

**Audience:** university students, mostly on mid-range Android phones and limited
mobile data. Mobile-first layout and page weight are product requirements here, not
polish — see [AGENTS.md](./AGENTS.md) for the full UI/UX rules.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.1.1 (App Router, Turbopack, React Compiler) |
| UI | React 19.2.3, Tailwind CSS v4 (CSS-first — **no `tailwind.config.js`**), framer-motion, lucide-react |
| Language | TypeScript 5, strict |
| State | Zustand (`src/lib/stores/*.store.ts`) |
| Forms | react-hook-form + zod |
| Data | Supabase (Postgres) via `@supabase/supabase-js`, service-role only (`src/lib/db.ts`) |
| Migrations | `supabase/migrations/`, applied by GitHub Actions — see [`docs/DATABASE-CICD.md`](./docs/DATABASE-CICD.md) |
| Rebuilding from nothing | [`docs/FRESH-START.md`](./docs/FRESH-START.md) — fresh Supabase account to working portal |
| **Handing over** | [`docs/HANDBOOK.md`](./docs/HANDBOOK.md) — the successor's handbook: every role, screen, yearly task and runbook |
| Backups | `pnpm backup` — System Admin sign-in required; `--encrypt` for a `.rcfvault` |
| Package manager | **pnpm only** — never npm/yarn |

## Getting started

```bash
cp .env.example .env.local   # then fill in the values
pnpm install
pnpm dev                     # http://localhost:3000
```

### Environment

Every variable is documented in [`.env.example`](./.env.example):

- `SUPABASE_URL`: the project the app talks to
- `SUPABASE_SERVICE_ROLE_KEY`: service role, **bypasses RLS**, server-only
- `SESSION_SECRET`: pepper for password hashing and session tokens (`openssl rand -hex 32`)
- `PRODUCTION_SUPABASE_URL`: which project is production, so the scripts and the app
  can tell
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`: optional,
  for photo and banner uploads

Only the Cloudinary values may carry a `NEXT_PUBLIC_` prefix. That prefix ships the
value to the browser.

Outside production (staging, previews, local dev against a dev database) the portal only
accepts `@rcffuta.test` email addresses when someone registers, updates their record or
signs up for an event.

### Database

Migrations live in `supabase/migrations/` and are applied by GitHub Actions, never by
hand. A push to `stage` applies them to staging; a push to `main` applies them to
production after an approval. Runbook: [docs/DATABASE-CICD.md](./docs/DATABASE-CICD.md).

| | |
|---|---|
| `supabase/migrations/` | the only SQL that runs. Create files with `supabase migration new <name>` |
| `db/seed/default.sql` | structure: units, offices, privileges, module access. Runs in production. Generated, additive, re-runnable |
| `db/migrations/` | the archived 0001–0013 series, folded into the baseline. Never applied again |

Rebuilding everything from a fresh Supabase account:
[docs/FRESH-START.md](./docs/FRESH-START.md).

**Resetting a staging or dev project** back to a known state — one command:

```bash
pnpm db:reset-staging
```

It clears every data table, recreates the active tenure and its five generations,
provisions a System Admin, and seeds 110 members (20 per generation, ten brothers and
ten sisters each, plus ten not yet placed). Structure — units, offices, privileges,
module access — and `schema_migrations` and `residential_zones` are preserved, because
wiping those would make it a rebuild rather than a reset.

It cannot reach production: the environment picker never offers a production `.env`,
the confirmation makes you type the project ref in full rather than `y/N`, and the
clear uses `DELETE` rather than `TRUNCATE ... CASCADE` so a foreign key from one of the
four other applications sharing the database raises an error instead of cascading.
Full detail, including the flags for running the pieces separately, is in
[docs/DATABASE-CICD.md](docs/DATABASE-CICD.md#resetting-staging).

`db/seed/default.sql` is **generated** from `src/config/fellowship-units.ts` and
`src/config/leadership-positions.ts`. Edit those, then:

```bash
node scripts/gen-default-seed.mjs            # regenerate
node scripts/gen-default-seed.mjs --check    # CI: fail if out of date
```

### Versioning — the database decides the number

| | |
|---|---|
| **PATCH** | code only. No migration; deploying does not touch the database |
| **MINOR** | a new migration exists. SQL must be applied |
| **MAJOR** | not safely reversible — dropped columns or tables, or a manual data step |

So a version tells you whether a deploy needs SQL, which matters more here than
semver's usual API-compatibility promise: there is one deployment and no consumers.

```bash
node scripts/release.mjs                   # dry run — proposes the version + changelog
node scripts/release.mjs --commit --tag    # write CHANGELOG.md, bump package.json, tag
node scripts/release.mjs --major --commit  # MAJOR is never inferred; you pass it
```

### Other tools

```bash
node scripts/db-inventory.mjs      # row counts, grouped PORTAL / FOREIGN / UNCLASSIFIED
node scripts/restore-backup.mjs    # restore a .rcfvault (dry run by default)
node scripts/purge-auth-users.mjs  # delete orphaned Supabase auth.users rows
```

> **This Supabase project is shared by five applications.** `rw_*` (ReadWrite store),
> `fyb_*` (Final Year Brethren), `elib_*` (e-library) and `game_*`/`trivia_*`/`bingo_*`/
> `buzzer_*` (games) are **not ours**. Run `db-inventory.mjs` before and after any
> migration: no FOREIGN row count may change.

> **`public.auth_sessions` is ours; `auth.users` is Supabase's.** The portal left
> Supabase Auth in migration `0001`. `auth_sessions` holds every leader's live session —
> deleting it logs out the whole fellowship. `purge-auth-users.mjs` refuses to touch
> anything in `public` for exactly this reason.

## Commands

```bash
pnpm dev      # dev server (Turbopack)
pnpm build    # production build — the real correctness check for routing/auth changes
pnpm start    # serve the production build
pnpm lint     # ESLint (next/core-web-vitals + typescript)
```

There is **no test runner configured**. `pnpm build` is the closest thing to a
regression check: most App Router and server-action mistakes only surface there.

> Note: `pnpm lint` currently reports a large backlog of pre-existing `indent`
> errors. Judge a change by whether it adds new findings in the files it touched.

## Project layout

```text
src/app/        App Router routes only. Route groups (auth) and (home) add no URL
                segment. Each feature route colocates its own actions.ts (server
                actions) and components/ folder.
src/components/ Shared UI by domain: ui/ (primitives), auth/, layout/, events/,
                dashboard/, lo-app/
src/lib/        Core logic: db.ts, auth-roles.ts, access-control.ts, auth/,
                invites.ts, env.ts, stores/, hooks/, utils.ts
src/config/     Static config; sidebar-items.tsx is the single source of truth for nav
src/proxy.ts    Next 16 network boundary (replaces middleware.ts, Node runtime)
supabase/       Migrations (applied by CI)
db/             Structure seed, schema dump, archived migrations
scripts/        One-off operational scripts
docs/           Design notes — see the caveat below
```

A new component starts in its route's `components/` folder; promote it to
`src/components/<domain>/` only when a second route needs it. Import via the `@/*`
alias, not long relative chains.

## Auth model (short version)

- Sessions are cookie-based (`httpOnly`, `sameSite=lax`), written only from server
  actions in `src/app/actions/auth.ts`.
- **`src/proxy.ts` only checks that a token is present, to choose redirect vs. allow.
  It is a UX convenience, never an authorization boundary.** Real permission checks
  belong in the server component / server action / route handler, via
  `src/lib/auth-roles.ts` and `src/lib/access-control.ts`.
- Roles (`USER`, `MODERATOR`, `ADMIN`) are *derived* from institutional profile data
  and leadership positions — never a field the client can set.
- `src/lib/db.ts` is the service-role client and bypasses RLS — every table has RLS
  enabled and forced with no policies, so it is the only way into the database.
  Server-only, and only after the caller's role has been checked. Never import it into
  a client component.
- Adding a new top-level public route means updating the hardcoded `publicRoutes`
  list in `src/proxy.ts`, or anonymous visitors get bounced to `/login`.

Appointing someone to a leadership position auto-provisions their `profile_login` row
with no password; they set one on first sign-in.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md): branches, checks, database rules, code style
and releases. [AGENTS.md](./AGENTS.md) is the full spec for this repo, for people and AI
agents alike.

## Project documents

| | |
|---|---|
| [docs/HANDBOOK.md](./docs/HANDBOOK.md) | The successor's handbook: every role, screen, yearly task and runbook |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How a change gets from a branch to production |
| [SECURITY.md](./SECURITY.md) | Reporting a problem privately, and rotating a leaked secret |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | How we work together, and how we treat member data |
| [CHANGELOG.md](./CHANGELOG.md) | What changed in each release |
| [LICENSE](./LICENSE) | Proprietary: all rights reserved to RCF FUTA |

## A note on the docs

`docs/` and the various feature-level markdown files were written at different points
and drift from the code. **When a doc and the code disagree, the code wins** — fix the
doc in the same PR rather than guessing which one is current.

## Licence

Proprietary. Copyright (c) 2026 RCF FUTA, all rights reserved. Members of the ICT unit
and others the fellowship authorises may use and change it for the fellowship's work.
See [LICENSE](./LICENSE).
