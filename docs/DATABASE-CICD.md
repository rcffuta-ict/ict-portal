# Database CI/CD — how migrations reach staging and production

Before this, migrations were pasted into the Supabase SQL editor by hand and nothing
recorded that they had run. This document replaces that.

## The map

| git branch | Supabase project | What happens on push |
|---|---|---|
| `main` | production | migrations applied, behind an approval gate |
| `stage` | staging | migrations applied |
| `dev`, `dev/**` | *none* | schema rebuilt from zero in CI; **nothing is deployed** |

`dev/**` deliberately does not deploy. A dev branch is where a migration is still being
written, and migrations here are forward-only — an accidental apply cannot be taken
back, only patched over. Dev branches are not unchecked, though: `ci.yml` replays every
migration from zero against a throwaway Postgres inside the runner, which never touches
a real project.

So a migration travels: written on `dev/**` → CI proves it builds a schema from scratch
→ merged to `stage` and applied to the staging database → merged to `main` and applied
to production after you approve.

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

Under **Secrets** — genuinely sensitive:

| Secret | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `PRODUCTION_DB_PASSWORD` | Project → Settings → Database → Database password |
| `STAGING_DB_PASSWORD` | as above, on the new project |

Under **Variables** — not secret, and you want them readable:

| Variable | Value |
|---|---|
| `PRODUCTION_PROJECT_ID` | `izofyqiaazidryoejsot` |
| `STAGING_PROJECT_ID` | the new project's ref, from its dashboard URL |

Project refs go in Variables on purpose. They are in the URL of every dashboard page
and in this file, so they are not worth protecting — and a ref stored as a *secret* is
masked as `***` in every log line, including inside `supabase projects list`, which
makes an authorisation failure almost impossible to diagnose. The workflows read
`vars.*` and fall back to `secrets.*`, so an existing secret keeps working.

One access token covers both, now that both projects are in the same account.

With the GitHub CLI installed (`gh auth login`) that is five commands instead of five
form submissions:

```bash
gh secret set SUPABASE_ACCESS_TOKEN
gh secret set PRODUCTION_PROJECT_ID   --body izofyqiaazidryoejsot
gh secret set PRODUCTION_DB_PASSWORD
gh secret set STAGING_PROJECT_ID      --body "<new project ref>"
gh secret set STAGING_DB_PASSWORD
```

Omitting `--body` makes `gh` read the value from a prompt rather than your shell
history, which is what you want for the two passwords and the token.

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

`supabase/config.toml` says `major_version = 17`, and production reports
`17.6.1.063` — already matching, verified 2026-09-20. Re-check with
`SHOW server_version;` if Supabase upgrades the project, otherwise the CI replay
starts testing a different Postgres than the one you deploy to.

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
git checkout -b dev/transfer-notes
supabase migration new add_transfer_notes     # creates the correctly-named file
$EDITOR supabase/migrations/2026…_add_transfer_notes.sql
git commit && git push -u origin dev/transfer-notes
```

That push deploys nothing. It runs `ci.yml`, which rebuilds the whole schema from zero,
replays it a second time, and applies the bootstrap seed on top — the check that would
have caught the `question_flags` dependency failure before it reached a SQL editor.

To try it against a real database, merge to `stage`. To ship it, merge to `main` and
approve the production job. You should not need the SQL editor again.

Want to try it locally first, without pushing at all:

```bash
supabase start        # local Postgres, builds from supabase/migrations/
supabase db reset     # replay everything from scratch
```

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

Take a backup first. There is no restore button on the Free plan:

```bash
pnpm backup -- --encrypt        # signs you in, then writes an encrypted bundle
```

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

### "Authorization failed for the access token and project ref pair"

This one message covers four different problems, which is why the workflows now list
the token's visible projects before attempting to link. Read that step's output:

- **The project is not in the list.** The token belongs to a different Supabase
  account. This is the likely one right after consolidating two accounts — a token
  generated while signed into the old account sees the old projects and not
  production. Generate a new one from the account that owns both projects.
- **The project is not in the list, and it is a scoped token.** It was not granted
  that project. Scoped tokens need the project explicitly selected, plus Migrations
  (Read-write), API Keys (Read), Project Settings (Read) and Database (Read).
- **The list itself fails** with *"Your account does not have the necessary
  privileges to access this endpoint"*. The token is valid but not permitted to
  enumerate the organisation. On a scoped token that can mean it was simply not given
  Organizations (Read) — but in practice, if both `projects list` and `link` refuse,
  stop tuning permissions and use a classic token. Scoped tokens are public alpha.
- **The list itself fails** some other way. The token is invalid, expired or revoked.
- **`link` 403s even though the token clearly works.** This is the one that cost us an
  afternoon, so here is the evidence rather than the theory. Tested against this
  account's own scoped token:

  | Management API call | Result |
  |---|---|
  | `GET /v1/projects` | 403 |
  | `GET /v1/organizations` | 403 |
  | `GET /v1/projects/{ref}` | **200** |
  | `GET /v1/projects/{ref}/api-keys?reveal=false` | **200** |
  | `GET /v1/projects/{ref}/api-keys?reveal=true` | 403 |

  `supabase link` calls that last one. The token had every project-level permission it
  needed and was correctly scoped to both projects — revealing API keys is the single
  thing it could not do, and it is not a permission you can grant
  ([supabase#50244](https://github.com/supabase/supabase/issues/50244), open).

  **No amount of scope tuning fixes this. Use a classic token.** Note it in the
  handover: classic tokens never expire and cover every project the account can reach,
  so whoever takes over should reissue one and revoke yours.

Check locally before touching the repository settings again:

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx supabase projects list
```

### The CLI is authenticated as the wrong account

Symptom: a 403 on a project you can plainly see in the dashboard, using a token you
just proved works by passing it inline.

The CLI resolves credentials in this order:

1. an exported `SUPABASE_ACCESS_TOKEN`, which wins over everything;
2. otherwise a token in the **system keyring**, left by an earlier `supabase login`.

After consolidating two Supabase accounts the keyring still holds the old one. So
`SUPABASE_ACCESS_TOKEN=sbp_new supabase projects list` succeeds, while
`pnpm db:bootstrap` — which spawns `supabase` as a subprocess — silently uses the old
account and 403s. Check what the stored credential actually sees:

```bash
env -u SUPABASE_ACCESS_TOKEN supabase projects list
```

If those are the wrong projects, `supabase login` with a token from the right account;
it overwrites the stored one. `pnpm db:bootstrap` now checks this before dumping and
names the account it is actually logged in as.

Do not keep the access token in `.env.local`. Nothing in this codebase reads it —
it is a CLI credential, and `supabase login` stores it in the CLI's own credential
store where it will not be picked up and loaded into `process.env` by every script
that calls `chooseEnvironment()`.

### The deploy is green, but the portal is slow or hangs

Symptom: after migrations, sign-in or every dashboard load takes 30 seconds or more, and
Vercel's log shows requests with a long duration or with no outgoing calls at all.

Cause: Supabase's API (PostgREST) is still serving its map of the OLD schema, so reads
get `503` ("schema cache not loaded") and supabase-js retries each one with backoff.
This happened on production after the 1.0.0 release.

Fix: in the SQL editor of that project, run

```sql
notify pgrst, 'reload schema';
```

Both deploy workflows now do this after every migration run ("Reload the API's schema
cache"). If it keeps happening, look in Supabase → Logs → PostgREST for "Failed to load
the schema cache"; a statement timeout there means the rebuild needs longer:
`alter role authenticator set statement_timeout = '60s';` then
`notify pgrst, 'reload config';` and the reload above.

## Resetting staging

`stage` and `dev` are for breaking things. When testing has left a project in a state
nobody can reason about, put it back:

```bash
pnpm db:reset-staging
```

One command, and it does four things in order:

1. **Clears every data table** — profiles, logins, sessions, appointments, events,
   testimonies, the audit log. Preserved: `schema_migrations`, `units`,
   `leadership_positions`, `position_privileges`, `module_access` and
   `residential_zones`. Those are structure and geography, not data; wiping the ledger
   would leave the database unable to say which migrations it has, and wiping the
   structure would mean re-running the seed to get a usable project back. That is a
   rebuild, not a reset.
2. **Recreates the active tenure** and its five generations, with entry years derived
   from the session rather than hardcoded.
3. **Provisions a System Admin**, so there is somebody to sign in as.
4. **Seeds 110 members** — 20 per generation, ten brothers and ten sisters each, plus
   ten not yet placed in a generation.

### It cannot touch production

Three independent guards, and the first one is the one that matters:

- The environment picker is called with `refuseProduction: true`, so a production
  `.env` is **never offered** — you cannot pick it by accident or by tabbing too fast.
- The confirmation asks you to **type the project ref in full**, not `y/N`. The whole
  risk is doing this to the wrong project, and a yes/no prompt does nothing to catch
  that.
- Clearing uses `DELETE`, never `TRUNCATE ... CASCADE`. Four other applications hold
  foreign keys pointing at `public.profiles`, and a CASCADE there would silently empty
  the ReadWrite store. `DELETE` raises a foreign-key error instead — which is the
  correct outcome, and the reason this is safe even pointed somewhere it should not be.

`scripts/seed-test.mjs` adds a fourth: it refuses a database with any rows in
`admin_audit_log`, on the grounds that administrative history means it is not a
scratch copy.

### The parts, if you want them separately

```bash
pnpm db:seed-staging                      # tenure + generations + System Admin, no wipe
pnpm db:seed-staging -- --with-members    # ...and the 110-member roster
pnpm db:seed-test -- --dry-run            # generate the roster, print a sample, write nothing
pnpm db:seed-test -- --reset-only         # remove every @rcffuta.test member and stop
pnpm db:seed-test -- --password 'dev-pass'  # give seeded leaders a password you can log in with
```

Pass `-- --env local` to skip the environment prompt, and `-- --yes` to skip the
confirmation in a scripted run. Without `--password`, seeded leaders get a NULL hash
and go through set-password-on-first-login, which is what really happens when somebody
is appointed.

### What the roster looks like

Every member is generated from one **origin** — Yoruba, Igbo, South-South or
Middle Belt — and the given name, middle name, surname and home town all come from it.
Department, school and matric prefix come from one FUTA programme, and the matric year
and date of birth come from the generation's entry year. Nothing is rolled that
something else has already implied, so there are no members called Chinedu Adeyemi from
Sokoto reading Computer Science in the School of Agriculture.

Two consequences worth knowing:

- **Finalists are only ever in five-year programmes.** FUTA's engineering,
  environmental and agricultural degrees run five years and the rest run four, so a
  500 Level Computer Science student is a student in a year their programme does not
  have.
- **The split is exactly ten and ten per generation.** A coin flip per member averages
  out even and is almost never even in practice, and a 14/6 generation reads on the
  level screen as a real imbalance somebody then tries to explain.

Every seeded address ends in `@rcffuta.test` — an RFC 2606 reserved TLD, so none of
them can resolve or receive mail even by accident. That domain is also the only handle
`--reset-only` uses to find them again.

Not seeded, deliberately: residential zones, events, Lo! content and unit rosters.
Zones are real fellowship geography and belong to whoever runs the tenure.

## Rebuilding from nothing

This document assumes both projects already exist. For the other case — a fresh
Supabase account, maybe only a backup file, and a successor who has never seen this
system — see **[FRESH-START.md](./FRESH-START.md)**. `pnpm db:bootstrap` detects that
the baseline is already committed and switches to provisioning a project from it,
without needing a production project to read.

## What is not automated

- `db/seed/default.sql` — bootstrap data (units, positions, privileges). Applied on
  purpose: by `pnpm db:bootstrap` when a project is first built, and by CI against the
  throwaway local database so a PR fails if a migration stops the seed fitting the
  schema. It is never applied automatically to a live project. There is no
  `supabase/seed.sql`, and `sql_paths` in `config.toml` is deliberately empty —
  Supabase only runs seed files on preview branches, which the Free plan does not have.
- `scripts/seed-test.mjs` — test data. Refuses to run against production. Driven by
  `pnpm db:reset-staging`; see **Resetting staging** above.
- `db/migrations/0001`–`0013` — archived, never applied again. See
  `db/migrations/README.md`.
