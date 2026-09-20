# db/migrations — ARCHIVED, does not run

These thirteen files are the history of the database up to the v1.0.0 handover. They
are kept for the record: `db/db-schema.sql`, `public.schema_migrations`,
`scripts/db-status.mjs` and the handover notes all refer to them by number.

**They are no longer applied by anything, and no new migration goes here.**

New migrations live in `supabase/migrations/` and are applied by CI. See
`docs/DATABASE-CICD.md`.

## Why they were retired rather than converted

The series is not self-contained. `0001_auth_rework.sql` opens with
`ALTER TABLE public.profiles`, and nothing in these files ever creates `profiles`,
`events`, `units`, `tenures`, `leadership`, `leadership_positions`,
`membership_units`, `class_sets`, `residential_zones`, `event_registrations`,
`event_questions`, `question_stars` or `question_flags`. Those tables came from a dump
that predates 0001 and was never committed as a migration.

Converting these files to timestamped names would have moved the problem, not fixed
it: a fresh database built from them would still be missing half its schema. The
starting point is what was missing, so `supabase/migrations/` begins with a dump of
the real thing instead.
