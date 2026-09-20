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
| Data | Supabase (Postgres) via the private `@rcffuta/ict-lib` SDK |
| Package manager | **pnpm only** — never npm/yarn |

## Getting started

Installing requires access to the private `@rcffuta/ict-lib` package on GitHub
Packages, so set `GITHUB_TOKEN` before the first install (see `.npmrc`).

```bash
cp .env.example .env.local   # then fill in the values
pnpm install
pnpm dev                     # http://localhost:3000
```

### Environment

Every variable is documented in [`.env.example`](./.env.example). The ones you cannot
run without:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — normal, RLS-respecting client
- `SUPABASE_SERVICE_ROLE_KEY` — service role, **bypasses RLS**, server-only
- `SESSION_SECRET` — pepper for password hashing and session tokens (`openssl rand -hex 32`)

Only URLs, the Supabase anon key, and the Cloudinary cloud name / upload preset may
carry a `NEXT_PUBLIC_` prefix — that prefix ships the value to the browser.

### Database

SQL lives in `db/`:

| | |
|---|---|
| `db/migrations/*.sql` | applied **by hand, in numeric order**, in the Supabase SQL editor — there is no migration runner |
| `db/seed/default.sql` | bootstrap structure: units and offices. Runs in production. Re-runnable, which makes it the **reset seed** |
| `db/db-schema.sql` | reference dump. Re-dump it after a migration; never hand-append to it |

**Which migrations has a database actually had?** Ask it:

```sql
select id, version, name, applied_at from public.schema_migrations order by id;
```

That table arrived with `0013`, which backfills `0001`–`0012`. Before it, the question
was unanswerable — migrations were applied by hand and nothing recorded that they had
been.

Setting up from scratch:

```bash
# 1. apply db/migrations/*.sql in order, then:
psql "$DATABASE_URL" -f db/seed/default.sql      # or paste into the SQL editor

# 2. someone who can log in
node scripts/bootstrap-admin.mjs <email> <password> [firstName] [lastName]

# 3. development only — ~110 fake members to test the handover against
node scripts/seed-test.mjs --i-understand-this-is-not-production --password 'dev-pass'
```

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
src/lib/        Core logic — ict.ts, auth-roles.ts, access-control.ts, auth/,
                invites.ts, stores/, hooks/, utils.ts
src/config/     Static config; sidebar-items.tsx is the single source of truth for nav
src/proxy.ts    Next 16 network boundary (replaces middleware.ts, Node runtime)
db/             Schema dump + ordered migrations
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
- `RcfIctClient.asAdmin()` is service-role and bypasses RLS: server-only, and only
  after the caller's role has been checked.
- Adding a new top-level public route means updating the hardcoded `publicRoutes`
  list in `src/proxy.ts`, or anonymous visitors get bounced to `/login`.

Appointing someone to a leadership position auto-provisions their `profile_login` row
with no password; they set one on first sign-in.

## Contributing

- **4-space indentation** (enforced by `eslint.config.mjs`) — this deliberately
  overrides the more common 2-space default.
- `src/components/ui/` is hand-rolled on purpose. Don't swap in shadcn/MUI.
- Read [AGENTS.md](./AGENTS.md) before starting — it is the canonical spec for this
  repo and applies to humans and AI agents alike.

## A note on the docs

`docs/` and the various feature-level markdown files were written at different points
and drift from the code. **When a doc and the code disagree, the code wins** — fix the
doc in the same PR rather than guessing which one is current.
