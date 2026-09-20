# supabase/migrations — the only SQL that runs

Everything in this folder is applied automatically by
`.github/workflows/deploy-staging.yml` and `deploy-production.yml`. Nothing else in
the repo is. If a change is not a file in here, it will not reach a database.

## Naming — this is not a style preference

    <14-digit timestamp>_<name>.sql        20260920131500_add_transfer_notes.sql

The CLI **silently skips** any file that does not match that pattern. It does not
error, and `db push` still reports success — so a badly named file looks like a
deploy that worked and changed nothing. Always create files with:

    supabase migration new add_transfer_notes

Never rename or edit a file after it has been applied to any project. The remote
ledger records the timestamp; changing it makes the CLI report the remote as having
migrations that no longer exist locally, and `db push` refuses to run.

## Why there is a baseline instead of 0001-0013

The old series in `db/migrations/` is a patch series against a starting point that was
never committed. `0001` begins `ALTER TABLE public.profiles`, and no migration in the
set ever creates `profiles` — nor `events`, `units`, `tenures`, `leadership`,
`leadership_positions`, `membership_units`, `class_sets`, `residential_zones`, or the
question tables. Those came from an unversioned dump. Replaying the series against an
empty database fails immediately, always would have.

So this folder starts from a real `pg_dump` of the production schema, which already
contains 0001-0013 correctly applied. See `docs/DATABASE-CICD.md` for how it was
generated and how both projects were told it is already applied.

`db/migrations/` is kept, unchanged, as the historical record.

## Seeds

There is deliberately no `seed.sql` here. Supabase only runs seed files on preview
branches, which the Free plan does not have, and seed data is never merged to
production. Bootstrap data stays in `db/seed/default.sql`, applied on purpose.


## Rehearse on Postgres 17, not whatever you have locally

`supabase/config.toml` pins `[db] major_version = 17` because production and staging
both run `17.6.1.063`. Rehearsing a migration on a different major version can pass and
still fail on deploy.

This has already happened once here, and the difference was a single statement:

```sql
DROP POLICY IF EXISTS "x" ON public.some_dropped_table;
```

`IF EXISTS` covers a missing POLICY, not a missing TABLE. On **PostgreSQL 16** that is a
NOTICE and the migration continues. On **PostgreSQL 17** it is
`ERROR: relation ... does not exist (SQLSTATE 42P01)` and the migration aborts. A
rehearsal on 16 went green; the push to staging failed on the same file.

The right local database is the one the CLI already pulls:

```bash
docker run -d --name pg17 -e POSTGRES_PASSWORD=x supabase/postgres:17.6.1.063
docker exec pg17 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/<migration>.sql
```

Use the `postgres` database inside it, not a fresh one — it comes with the `graphql`,
`vault`, `extensions` and `auth` schemas the baseline expects.

CI is already correct: `supabase start` reads `major_version` from `config.toml`.
