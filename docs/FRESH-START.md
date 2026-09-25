# Starting over from nothing

For whoever inherits this project. The situation this document assumes is the worst
one: a Supabase account that has never seen the portal, and maybe only a backup file.

Everything needed is in this repository. You do not need access to the old account, the
old project, or anyone who worked on this before.

## What lives where

| | |
|---|---|
| **Schema** | `supabase/migrations/` — the baseline plus everything since |
| **Structure** | `db/seed/default.sql` — units, positions, privileges. No people. |
| **Data** | a backup bundle (`.json` or encrypted `.rcfvault`), taken from the portal |
| **History** | `db/migrations/0001`–`0013`, archived and never applied again |

Schema and structure are in git. Data is not, and never should be.

## The sequence

### 1. Make a Supabase project

Any account, any plan. Note its **reference** (the string in the dashboard URL) and set
a database password you record somewhere.

Free tier allows two active projects per organisation, which is exactly enough for
production and staging. It has **no automatic backups and no point-in-time recovery** —
your own backup bundles are the only safety net, so take them.

### 2. Build the schema

```bash
supabase login                   # a CLASSIC access token; scoped tokens cannot link
pnpm install
pnpm db:bootstrap                # dry run — shows what it will do
pnpm db:bootstrap -- --apply
```

Pick the new project as TARGET. It applies `supabase/migrations/` and offers to apply
`db/seed/default.sql`. Say yes unless you are restoring a backup that already contains
the structure.

> The baseline is a `pg_dump`, not a replay of `db/migrations/`, and that is deliberate.
> Three objects the portal depends on — the `event_questions_with_details` view and the
> `search_questions` / `toggle_question_visibility` functions — were created by hand in
> the SQL editor and appear in no migration. Rebuild from `db/migrations/` and the Q&A
> feature breaks with no error anywhere. The dump has them; the script checks for them
> by name before accepting a baseline.

### 3. Point the app at it

```bash
cp .env.example .env.local
```

Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Project Settings, and
generate a pepper:

```bash
openssl rand -hex 32     # -> SESSION_SECRET
```

Set `PRODUCTION_SUPABASE_URL` in every env file, so the scripts can tell which project
is production by more than its filename.

### 4. Restore the data

```bash
node scripts/restore-backup.mjs <bundle>                   # dry run, always first
node scripts/restore-backup.mjs <bundle> --commit
node scripts/restore-backup.mjs <bundle> --password "..."  # for a .rcfvault
```

Rows upsert by primary key in the order the bundle lists them, which is FK-safe —
parents before children, so `profiles` lands before everything that references it.
Re-running is safe and a half-finished restore can simply be resumed.

**You should never be editing `profiles` by hand.** It is the identity table the whole
schema hangs off, and it is also shared with the other applications in the production
database. If a restore seems to need manual help there, something else is wrong — stop
and work out what, rather than patching rows.

Three things are deliberately absent from every bundle, because a file full of them
would be a credential dump:

- `profile_login.password_hash` — restored leaders have a NULL password and set one on
  first login, which is the same flow a new appointment already uses.
- `auth_sessions` — everyone signs in again.
- `registration_invites.token` — rotate level tokens afterwards.

This is also why a different `SESSION_SECRET` on the new project costs you nothing:
there are no hashes to invalidate.

### 5. Mint the first login

Until one leader has a password, nobody can sign in — there is no self-registration for
leaders.

```bash
node scripts/bootstrap-admin.mjs <email> <password>
```

That creates or reuses a profile, assigns the protected VP Administration position in
the active tenure, and sets a password in the same scrypt format the app uses.

### 6. Make sure there is a System Admin

The ICT Coordinator is the only position carrying the `SYSADMIN` tag. With nobody
holding it in the active tenure, Settings, the Oracle and full-system backup are
unreachable — and nothing warns you, because the portal works perfectly for everyone
else. It is the easiest thing in the world to forget right after a reset.

```bash
pnpm db:ict-coord          # read-only; safe on production, meant to be run there
```

It exits non-zero when the chain is broken, so it also works in CI or a cron. The chain
is: the position exists → is active → carries `SYSADMIN` → a tenure is active → someone
holds it → that person can sign in.

**On staging**, seed the default coordinator:

```bash
pnpm db:ict-coord -- --seed
```

That creates **Melchizedek Oracle** `<oracle@rcffuta.test>` and assigns the position in the
active tenure, with **no password**: the first sign-in with that address asks for one
(pass `--password` to set it from the command line instead). Sign in straight away on a
deployed staging URL — until you do, the first visitor to try that address chooses it.
`@rcffuta.test` is an RFC 2606 reserved TLD — it can never resolve or receive mail.

**On production this refuses to run**, and should. The System Admin there has to be a
real, accountable person; seeding a fictional one would put a working System Admin
login into a live system under a name nobody can be held to. Appoint them through the
portal instead, or use `bootstrap-admin.mjs` if literally nobody can sign in yet.

### 7. Check it

```bash
pnpm db:status      # schema against the ledger
pnpm db:inventory   # row counts per table
pnpm dev
```

Sign in as the admin from step 5.

### 8. Take a backup, now that it is worth backing up

```bash
pnpm backup              # plain JSON into .backups/
pnpm backup -- --encrypt # AES-256-GCM .rcfvault, for anywhere off this machine
```

It asks you to sign in with a portal account holding `SYSADMIN` before it reads
anything. That is accountability, not access control — the script already has the
service-role key, so it is not stopping a determined holder of `.env.local`. What it
buys is that the bundle and `admin_audit_log` both carry a real person's name, and that
a deactivated or locked-out leader's credentials stop working from a terminal the same
way they stop working in the browser.

`.backups/` is git-ignored. A plain bundle contains every member's name, email and
phone number, so encrypt anything that leaves your machine.

### 9. Wire CI back up

`docs/DATABASE-CICD.md` — the GitHub secrets and variables, the `production`
environment and its required reviewer. From then on, `stage` and `main` apply
migrations for you and the SQL editor stays closed.

## Things that will confuse you

**`supabase link` fails with an authorisation error.** Almost always the CLI is
authenticated as a different account. It prefers an exported `SUPABASE_ACCESS_TOKEN`,
and otherwise reads a token from the system keyring left by an earlier `supabase login`
— which survives you switching accounts. Check with:

```bash
env -u SUPABASE_ACCESS_TOKEN supabase projects list
```

**Scoped access tokens cannot link.** They are public alpha, and `supabase link` reveals
project API keys, which scoped tokens are refused even on the Full access preset
([supabase#50244](https://github.com/supabase/supabase/issues/50244)). Use a classic
token. It will not expire, so revoke it when you hand over in turn.

**Avatars are on Cloudinary, not Supabase Storage.** Nothing uses Supabase Storage, so
there are no buckets to recreate. Without the two `NEXT_PUBLIC_CLOUDINARY_*` variables
photo upload is simply disabled, and avatars are optional throughout the portal.

**The other applications are not here.** The production database is shared with
ReadWrite (`rw_*`), Final Year Brethren (`fyb_*`), an e-library (`elib_*`) and some
games. The baseline deliberately excludes them — this repo owns the portal and nothing
else. If you are rebuilding the whole shared database, those teams have their own
schemas and you should ask them rather than guess.
