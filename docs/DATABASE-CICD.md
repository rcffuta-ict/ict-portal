# Database CI/CD — how migrations reach staging and production

Before this, migrations were pasted into the Supabase SQL editor by hand and nothing
recorded that they had run. This document replaces that.

## The map

| git branch | Supabase project | Applied by |
|---|---|---|
| `main` | production `izofyqiaazidryoejsot` | `.github/workflows/deploy-production.yml` |
| `stage`, `dev`, `dev/**` | staging (the new project) | `.github/workflows/deploy-staging.yml` |

Both projects live in **one Supabase account** — the one that holds production. Staging
used to be a project in a separate account, which meant two logins, two access tokens
and no way for one workflow to reach both. The replacement is a new project created in
the production account's remaining Free slot.

Staging and development share that one project. The Free plan allows two active projects
per organisation and production holds the other one. **This means a staging rehearsal runs
against test-seeded data, so it proves a migration applies — not how it behaves on the
production dataset.** If that distinction ever matters for a release, the fix is a third
project (pause one, use a second organisation, or go Pro).

Supabase *branching* — preview branches per pull request — is Pro-only at
$0.01344/branch/hour and is not in use here. The GitHub Actions workflows do the same
job for migrations on any plan.

## The Next.js app

Vercel deploys the app from its own Git integration (see commit `00560b5`). Nothing in
`.github/workflows/` deploys the app, deliberately — running a second deploy pipeline
alongside Vercel's produces two deployments racing for the same URL. `ci.yml` only
lints and builds, so a PR fails here before Vercel wastes a build on it.

Vercel must have `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`,
`PRODUCTION_SUPABASE_URL` and the two `NEXT_PUBLIC_CLOUDINARY_*` values set per
environment. `SESSION_SECRET` must be identical to the one used locally or every
existing password and session is invalidated — it is the scrypt pepper.

## One-time setup

### 1. GitHub secrets

Repository → Settings → Secrets and variables → Actions:

| Secret | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `PRODUCTION_PROJECT_ID` | `izofyqiaazidryoejsot` |
| `PRODUCTION_DB_PASSWORD` | Project → Settings → Database → Database password |
| `STAGING_PROJECT_ID` | the new project's ref, from its dashboard URL |
| `STAGING_DB_PASSWORD` | as above, on the new project |

One access token covers both, now that both projects are in the same account.

The database password is not the service-role key and is not in any `.env` file. If
nobody knows it, reset it in the dashboard — that is safe, the portal connects over
PostgREST with the service-role key, not over Postgres. You set the new project's
password when you created it.

Once the new project exists, point the local environment files at it too:
`.env.local` and `.env.development` should carry its `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, and every environment file needs `PRODUCTION_SUPABASE_URL`
set to the production URL — that is what `scripts/lib/cli.mjs` uses to refuse to run a
destructive script against production.

### 2. Require approval before production

Settings → Environments → `production` → add yourself as a required reviewer. The
production job then pauses for approval before touching the database. Do this. **The
Free plan has no automatic backups and no point-in-time recovery** — if a migration
corrupts production there is no restore button, only the system-insurance backup taken
from the portal (Settings → System insurance).

### 3. Match the Postgres version

Run `SHOW server_version;` in the production SQL editor and set `major_version` in
`supabase/config.toml` to match. Otherwise the CI replay tests a different Postgres
than the one you deploy to.

### 4. Build the baseline and the new project

```bash
supabase login
pnpm db:bootstrap              # dry run: dumps, filters, reports, writes nothing
pnpm db:bootstrap -- --apply   # does it for real
```

`scripts/bootstrap-supabase.mjs` treats the two projects differently, because they are
in completely different states:

- **SOURCE (production)** already has the schema. It gets exactly one write: a row in
  the CLI's ledger saying the baseline is already applied. No DDL, no data, nothing
  dropped. This is the step that stops the first push to `main` replaying 0001's
  `auth.users` FK drop and RLS lockdown against a live database.
- **TARGET (the new project)** is empty. It gets the baseline applied for real, then
  `db/seed/default.sql` if you say yes.

What it produces is `supabase/migrations/20260101000000_0000_baseline.sql` — a
`pg_dump` of production, dated in the past so every migration you write from now on
sorts after it regardless of when you ran this.

**The other four applications are filtered out.** This database is shared by ReadWrite
(`rw_*`), Final Year Brethren (`fyb_*`), the e-library (`elib_*`) and the games
(`game_*`, `trivia_*`, `bingo_*`, `buzzer_*`). Their objects are removed from the
baseline so the portal's staging project is the portal and nothing else, and so this
repo does not quietly version-control another app's schema and let it drift.

That is safe in this specific database because every one of the 45 references between
these applications points *at* `public.profiles` — no portal table references a foreign
one (see `scripts/prune-profiles.mjs`). The script proves it anyway: it refuses to
write a baseline where a kept object still references a removed one. Pass
`--include-foreign` to keep everything.

**Nothing is removed from production.** The filter only shapes a file that gets applied
to the new, empty project. Production is only ever read from.

Before writing, the script checks the dump really is at 0013's end state — ledger
present, `question_flags` kept, `leadership_positions.category` and `is_default` gone,
`rcf_profile_context` present, every portal table accounted for — and aborts if not. A
dump taken from the wrong project is perfectly valid SQL and would otherwise become the
thing every future environment is built from.

Read the generated file before committing. Then watch the first CI run of the
`migrations` job: `pg_dump` output occasionally carries `ALTER ... OWNER TO` lines
naming roles that exist on Supabase but not in a bare local Postgres. If the replay
fails on a missing role, delete those lines — ownership is not something this repo
should be asserting. Do not "fix" it by weakening the CI job; a replay that cannot
rebuild the schema is the one check here worth having.

### 5. Prove it

Push a no-op commit to `stage`. The workflow should run and report that the remote
database is up to date, having applied nothing.

`supabase migration list` showing the baseline in the Local column and blank in Remote
means the repair did not take. Do not push to `main` until both columns match on the
production project.

## Writing a migration, from now on

```bash
supabase migration new add_transfer_notes     # creates the correctly-named file
$EDITOR supabase/migrations/2026…_add_transfer_notes.sql
git checkout -b dev/transfer-notes && git commit && git push
```

Pushing to `dev/**` applies it to staging. Open a PR — `ci.yml` rebuilds the whole
schema from zero and replays it twice, which is the check that would have caught the
`question_flags` dependency failure before it reached a SQL editor. Merge to `main`,
approve the production job, done.

**Never rename or edit a migration after it has been applied anywhere.** The remote
ledger stores the timestamp; changing it makes the CLI report remote migrations that no
longer exist locally and `db push` refuses to run.

**Never create a migration file by hand.** The CLI silently skips any file not matching
`<14-digit timestamp>_name.sql` — it does not error, and `db push` still reports
success. A misnamed file looks exactly like a deploy that worked and changed nothing.

## The two ledgers

| Table | Who writes it | What it is for |
|---|---|---|
| `supabase_migrations.schema_migrations` | the CLI | machine authority; decides what `db push` applies |
| `public.schema_migrations` | migration 0013 | human record; also stores the *release* each migration shipped in, which the CLI's does not |

They are not redundant and neither replaces the other. If you add a migration that you
want reflected in the human ledger, insert its row yourself in that migration.

## When a deploy fails

The job fails loudly. `db push` applies each migration file inside a transaction, so a
failed file rolls back whole and the database is left as it was — this is what happened
when 0013 hit the `question_flags` dependency. Open your migrations with an explicit
`BEGIN;`/`COMMIT;` anyway, as 11 of the 13 archived ones do (0009 and 0010 are the
exceptions, and are not a precedent to follow): it makes the guarantee visible to
whoever reads the file, and it survives being pasted into the SQL editor.

Fix forward — write a new migration. Do not edit the failed one if it succeeded
anywhere else.

If the failure is "Remote migration versions not found in local migrations directory",
someone renamed or deleted an applied file. Restore it, or
`supabase migration repair --status reverted <version>` to drop the orphan row.

## What is not automated

- `db/seed/default.sql` — bootstrap data (units, positions, privileges). Applied on
  purpose: by `pnpm db:bootstrap` when a project is first built, and by CI against the
  throwaway local database so a PR fails if a migration stops the seed fitting the
  schema. It is never applied automatically to a live project. There is no
  `supabase/seed.sql`, and `sql_paths` in `config.toml` is deliberately empty —
  Supabase only runs seed files on preview branches, which the Free plan does not have.
- `scripts/seed-test.mjs` — test data. Refuses to run against production.
- `db/migrations/0001`–`0013` — archived, never applied again. See
  `db/migrations/README.md`.
