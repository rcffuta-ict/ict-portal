# Restart here

Everything still outstanding, in the order it has to happen. Written at the end of a
session so the next one can start cold — no memory of the conversation required.

Two independent tracks. **Track A** builds the staging database. **Track B** makes CI
able to deploy. They don't depend on each other, so do them in either order, but
neither is finished until its verification step passes.

---

## Where things stand right now

| | |
|---|---|
| Branch | `main`, clean |
| Unpushed commits | **7** (`2929c1e` … `69ca90a`) |
| `supabase/migrations/` | `20260920162209_tighten_office_catalogue.sql` + README. **No baseline yet.** |
| Staging project | `mehlqxqmwmyermoqsekq` — empty, never provisioned |
| Production project | `izofyqiaazidryoejsot` — live, untouched by any of this |
| CI | Red. Two causes, both fixed in `69ca90a`; a third (the token) is yours to fix. |

The baseline has been attempted twice and failed both times at the same place — the
Docker image pull — leaving two 0-byte files in `.tmp/`. **Nothing partial was written.**
The script aborts before it audits or writes a baseline, so there is no half-built state
to clean up. Delete the empty files whenever you like; they are ignored.

---

## ⚠ Read this first — the baseline is blocked

`pnpm db:bootstrap` now gets as far as the audit and **stops**, correctly. Two findings
came out of that run, and the second is a decision only you can make.

### 1. The filter was broken. Fixed.

`supabase db dump` quotes every identifier — `"public"."rw_orders"`, never
`public.rw_orders` — and three separate checks in `bootstrap-supabase.mjs` matched only
the unquoted form. They therefore matched *nothing*, and reported clean.

Measured against production's actual dump: **115 foreign objects would have been written
into the baseline** — 24 indexes on ReadWrite tables, 30 comments, 61 grants. The indexes
would have made `db push` fail on a fresh project, which is the *lucky* outcome; the
unlucky one is a baseline that applies fine and quietly carries another application's
objects into every environment built from it. `findDanglingReferences()` said "no
dangling references" for the same reason.

Two audit checks were also passing falsely — `leadership_positions has no category` was
green while production's `category` column was sitting right there in the dump.

All fixed, and re-verified against the real dump: 115 leaks → 0, kept blocks 533 → 418,
every portal table and all three hand-made Q&A objects still present. **The lesson worth
keeping: the synthetic fixture this was originally tested against used unquoted
identifiers. Real pg_dump output does not.**

### 2. Production is at 0010, not 0013

This is the blocker. Production's `leadership_positions` still looks like this:

```
"category" "text" NOT NULL,          <- 0013 drops this
"is_default" boolean NOT NULL,       <- 0013 drops this
"is_central" boolean NOT NULL,
```

no `tier`, no `is_protected`, and these four tables do not exist at all:
`schema_migrations`, `unit_transfer_requests`, `handover_intents`, `handover_events`.

**Migrations 0011, 0012 and 0013 were never applied to production.** They went to the
old dev project and stopped there — which is exactly the failure mode this whole CI
effort exists to end.

It also means the committed app code cannot run against production as it stands:
`src/lib/positions.ts` selects `tier, is_protected`, and the transfers tab queries
`unit_transfer_requests`.

### Decision: Option B, and it is already done

The baseline is taken from production **as it stands (0010)**, and 0011/0012/0013 are
now real migrations that run after it:

```
supabase/migrations/
  20260101000000_0000_baseline.sql                      <- you still generate this
  20260101000100_0011_frozen_catalogue_and_transfers.sql
  20260101000200_0012_handover_intents.sql
  20260101000300_0013_structural_cleanup.sql
  20260920162209_tighten_office_catalogue.sql
```

So staging is built from baseline → 0011 → 0012 → 0013 → tighten → seed and is
**rehearsed first**; production then takes the same four through the approval gate,
instead of being hand-edited in the SQL editor.

**Rehearsing it immediately found a defect in 0013.** Replayed against production's
actual schema on a throwaway Postgres, `DROP COLUMN category` failed:

```
ERROR: cannot drop column category of table leadership_positions
       because other objects depend on it
```

Three RLS policies on `question_flags`, `event_questions` and `question_references`
still referenced `lp.category`. They are vestigial — they test `auth.uid()`, which has
been NULL since Supabase Auth was retired, on tables that are service-role-only with
RLS forced and no policies — so they granted nothing to anyone. But they were enough to
block the column drop, and every environment would have hit it. 0013 now drops them
explicitly first (not `DROP COLUMN ... CASCADE`, which would remove unnamed dependents
and set up the next surprise).

**Correction to what I said earlier:** I claimed 0013 had a known failure mode around
`question_flags`. That was wrong — the committed 0013 deliberately *keeps*
`question_flags` and says so at length. The real defect was the three policies above,
and it was only findable by running the thing.

Verified end to end on Postgres 16: baseline → 0011 → 0012 → 0013 → tighten → seed all
apply clean; `category`, `is_default` and `is_central` are gone; `tier`, `is_protected`
and `grants_login` are present; 36 offices, 25 units, 13 ledger rows; `gen-sec` and
`fin-sec` honorary with no login, everything else with one.

> The ledger is 0013's job, not the baseline's. 0013 creates `public.schema_migrations`
> and backfills 0001–0012 with better notes than the bootstrap script could invent, so
> the script no longer appends its own rows when the source is pre-0013 — it would be
> inserting into a table the next migration is about to create.

**Still take `pnpm backup` against production before the first `main` deploy.**

---

## Track A — build the staging database

### A1. Pull the one Docker image

`supabase db dump` does not use a local `pg_dump`. It runs `pg_dump` **inside a
container** whose Postgres version matches the server, because a client older than the
server refuses to dump at all. You have no `pg_dump` installed, so this is the only way.

```bash
docker pull supabase/postgres:17.6.1.063
```

The tag is pinned to production's actual version (`17.6.1.063`), which is also what
`[db] major_version = 17` in `supabase/config.toml` maps to. It is a full Postgres build
with Supabase's extensions — over a gigabyte, ~30 layers, and slow once. Cached after.

**If Docker Hub gives you `network is unreachable`** (it did earlier, on an IPv6
address), use the AWS mirror, which is already reachable from this machine:

```bash
docker pull public.ecr.aws/supabase/postgres:17.6.1.063
docker tag public.ecr.aws/supabase/postgres:17.6.1.063 supabase/postgres:17.6.1.063
```

The `docker tag` line is not optional — the CLI looks the image up by its short name, and
without the alias it will just try to pull again.

Confirm: `docker images | grep supabase/postgres`

**Only `db dump` needs Docker.** `link`, `migration list`, `migration repair`, `db push`
and `db query` all talk to Postgres directly from the Go binary. So this cost is paid
once, on this machine, by you — and never by whoever inherits this repo, because their
path (below) doesn't dump anything.

### A2. Make sure the CLI is logged in as the right account

This bit already the cost of one debugging session. The CLI resolves credentials in this
order: an exported `SUPABASE_ACCESS_TOKEN` wins; otherwise it reads a token from the
**system keyring**, left there by an earlier `supabase login`. The keyring held the old
account's token long after that account stopped being the right one, and every error it
produced said "authorization failed" rather than "wrong account".

```bash
supabase login           # paste the CLASSIC full-access token; overwrites the keyring
supabase projects list   # must show BOTH refs below
```

You should see `izofyqiaazidryoejsot` **and** `mehlqxqmwmyermoqsekq`. If you see
`movio-app` or `kcyylplbizwgttqjdezf`, the keyring is still on the old account — log in
again. `bootstrap-supabase.mjs` checks this itself now and stops before dumping, but
confirming by hand takes five seconds and reads clearly.

### A3. Dry run

```bash
pnpm db:bootstrap
```

Writes nothing. It prints the plan: which project it will read, which it will write, and
every command it intends to run. Read it. If it names production as the target, stop.

### A4. Apply

```bash
pnpm db:bootstrap -- --apply
```

In order, this:

1. Links to **production** and dumps its schema (`--keep-comments`, schema only, no
   rows, no writes).
2. Filters out the four foreign applications that share that database — ReadWrite,
   Final Year Brethren, E-library, Games. They are other people's tables and must not
   appear in our baseline.
3. **Audits** the result and refuses to write a baseline that fails. Among other things
   it checks for `event_questions_with_details`, `search_questions` and
   `toggle_question_visibility` — three objects that exist in **no migration at all**,
   because they were created by hand in the SQL editor. Rebuild from `db/migrations/`
   alone and the Q&A feature dies silently. The dump catches them; the audit makes sure.
4. Writes `supabase/migrations/20260101000000_0000_baseline.sql`.
5. Marks that baseline as already-applied on **production** (`migration repair`) — a
   ledger row only, no DDL. Production's schema is not touched.
6. Pushes to **staging**: baseline, then `20260920162209_tighten_office_catalogue.sql`.
7. Offers to run `db/seed/default.sql`. Say yes.

> The order in step 6 matters and is already correct. The baseline is dumped from
> production *as it is today*, so it will not contain `grants_login`; the tighten
> migration adds it on top. The seed then inserts that column, so the seed **requires**
> that migration. Baseline → migration → seed. Don't run the seed by itself against a
> project that has only the baseline.

### A5. Verify

```bash
pnpm db:status        # ledger vs schema
pnpm db:inventory     # row counts per table, grouped by owning app
```

Then create the staging System Admin — **staging only**, the script refuses production:

```bash
pnpm db:ict-coord -- --seed --env local
```

That creates **Melchizedek Oracle** `<oracle@rcffuta.test>` with **no password**: sign in
with that address and the login screen asks you to choose one, exactly as it does for any
newly appointed leader. Do it straight away on a deployed staging URL — until you do,
whoever reaches the login screen first with that (public) address gets to choose it.
`.test` is an RFC 2606 reserved TLD — it can never resolve or receive mail, which is the
point.

Then check the whole chain holds:

```bash
pnpm db:ict-coord              # read-only, safe anywhere, exits non-zero on a problem
```

It verifies: the position exists → is active → carries `SYSADMIN` → a tenure is active →
somebody holds it → that person can sign in. Run the same command against production
later; it will tell you whether a real person has been appointed.

### A6. Take a backup

```bash
pnpm backup
```

Signs you in with email + password against `profile_login`, applying the same rules as
the web login (active check, lockout, 5 attempts / 15 minutes), then requires `SYSADMIN`
in the active tenure. Writes to `.backups/`, which is git-ignored — a plain bundle holds
every member's name, email and phone number. `pnpm backup -- --encrypt` for a `.rcfvault`.

Be clear-eyed about what that sign-in is: the script already holds the service-role key,
so it is **accountability, not access control**. Anyone with `.env.local` could write
their own script and skip it. What it buys is that the bundle and the audit row carry a
real person's name.

---

## Track B — make CI able to deploy

### B1. Fix the access token — this is why `link` fails

The failure you are seeing:

```
Authorization failed for the access token and project ref pair:
{"message":"Your account does not have the necessary privileges to access this endpoint."}
```

**That sentence is not about the project ref.** `supabase link` reports every
authorisation problem with the same message, and it covers at least four different
faults. This particular wording — *"does not have the necessary privileges to access this
endpoint"* — is the signature of a **scoped token**, which cannot `link` at all.

Traced empirically last session:

| Endpoint | Scoped token |
|---|---|
| `GET /v1/projects` | 403 |
| `GET /v1/organizations` | 403 |
| `GET /v1/projects/{ref}` | **200** |
| `GET /v1/projects/{ref}/api-keys?reveal=false` | **200** |
| `GET /v1/projects/{ref}/api-keys?reveal=true` | **403** |

That last row is the one `supabase link` calls. Scoped tokens are in public alpha and
cannot reveal project API keys — **even on the Full access preset**. It is
[supabase#50244](https://github.com/supabase/supabase/issues/50244), not a scope you can
tune your way out of.

You already made a classic full-access token and confirmed it works locally. **The
GitHub secret is still holding the old scoped one.** Replace it.

Test the exact string before pasting it — and test it this way, with the variable on the
command line, because otherwise the CLI reads the keyring and you will be testing a
different token than the one you are about to paste:

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxxxx supabase projects list
```

Both refs must appear. Then set it at
**Settings → Secrets and variables → Actions**.

### B2. Repository Variables — not secrets

| Name | Value |
|---|---|
| `PRODUCTION_PROJECT_ID` | `izofyqiaazidryoejsot` |
| `STAGING_PROJECT_ID` | `mehlqxqmwmyermoqsekq` |

**Variables, deliberately, not secrets.** A project ref is not secret — it is in the URL
of every dashboard page and in `docs/DATABASE-CICD.md`. Stored as a *secret*, GitHub
masks it as `***` everywhere, including inside `supabase projects list` output, which
destroys the one diagnostic that separates a wrong token from a wrong ref. The workflows
read `vars.X || secrets.X`, so an existing secret still works — but move it.

### B3. Repository Secrets

| Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | the **classic** token from B1 |
| `PRODUCTION_DB_PASSWORD` | production database password |
| `STAGING_DB_PASSWORD` | staging database password |

### B4. Environments

Create two, at **Settings → Environments**:

- `staging` — no protection.
- `production` — **add yourself as a required reviewer.**

That second one is the whole safety model. The Free plan has **no automatic backups and
no point-in-time recovery**; if a migration corrupts production there is no restore
button, only the bundle from `pnpm backup`. The approval gate is what turns "I pushed to
main" into a deliberate act.

### B5. Push

```bash
git push origin main
```

Seven commits. Pushing to `main` triggers `deploy-production.yml`, which will pause for
your approval — so B4 has to be done first, or it deploys unattended.

### B6. Verify CI is actually green

Watch both jobs in Actions:

- **`app`** — installs, lints (non-blocking), builds. The lint step is
  `continue-on-error: true` because the repo carries ~6,500 pre-existing problems.
  *When `pnpm lint` finally exits 0 on main, delete that line.*
- **`migrations`** — replays every migration from zero into a throwaway Postgres, twice,
  then applies the seed and lints the schema.

---

## The branch map

| Push to | What happens |
|---|---|
| `dev`, `dev/**` | CI only. **Deploys nothing.** A half-written migration applied to a shared database cannot be taken back. |
| `stage` | Applies pending migrations to **staging**. |
| `main` | Applies pending migrations to **production**, behind the approval gate. |

Both deploy workflows are path-filtered on `supabase/migrations/**`, so a docs-only
commit doesn't wake them.

---

## Writing a migration, from here on

```bash
supabase migration new short_name
```

**Never hand-create the file.** The CLI silently skips any file not matching
`<14-digit timestamp>_name.sql` — it reports success and applies nothing. You can see it
happening in the CI logs: `Skipping migration README.md...`.

Then `pnpm release` decides the version from what changed: PATCH = code only, MINOR = a
new migration exists, MAJOR = not safely reversible.

---

## Loose ends I did not touch

- **`.env.local.dev`** still points at the retired dev project `kcyylplbizwgttqjdezf`.
  Almost certainly deletable — but it is yours, not mine, and deleting a file with
  credentials in it on a guess is not a call I should make.
- **`.plan/db-refresh.md`** and **`.plan/PROGRESS.md`** are from a completed plan.
- **`scripts/bootstrap-admin.mjs`** matches the VP Admin position by `title`, which is
  editable from the UI. This is the same class of bug migration 0013 fixed in the auth
  RPC — rename the office in the UI and the script stops finding it. Should match on
  `slug`. Flagged, not fixed; it is a real bug but not one that was in scope.
- **The scoped token `sbp_fcdb…8453`** appeared in a transcript. You said you would
  revoke it. Still worth doing.
- **`actions/checkout@v4` / `actions/setup-node@v4`** produce a Node 20 deprecation
  notice. Harmless — GitHub already runs them on Node 24. Bump to `@v5` when you next
  touch that file, not as part of a fix you are trying to verify.

---

## If you have to start over completely

A successor with a brand-new Supabase account and nothing else follows
**`docs/FRESH-START.md`** — nine steps from empty account to working install. Their path
is much shorter than yours, because the baseline is committed by then:

```bash
supabase login
pnpm db:bootstrap -- --apply    # PROVISION mode: no dump, no Docker, no production
```

The script detects which mode it is in by whether the baseline file exists. **Your** run
is the one-time GENERATE that produces it. Every run after that is PROVISION.

Restoring data is `scripts/restore-backup.mjs`, which upserts by primary key in FK-safe
order — parents before children, so `profiles` lands before everything that references
it. You should never need to hand-edit it; needing to means something else is wrong.

The full runbook, including the two migration ledgers and the troubleshooting table, is
**`docs/DATABASE-CICD.md`**.
