-- ============================================================================
-- A tenure has no name: drop tenures.name
-- ============================================================================
--
-- A tenure is its SESSION, its THEME and its THEME TEXT (see
-- 20260924095226_tenure_identity_and_workforce.sql). That migration stopped the app
-- needing `name` and reported every value that would stop being shown; nothing in the
-- app, the seed scripts or the backups has read or written it since.
--
-- NOT SAFELY REVERSIBLE — release as MAJOR (`pnpm release -- --major`). Re-adding the
-- column would bring back an empty column, not the names. They survive in every backup
-- taken before this release, and `scripts/restore-backup.mjs` strips the column when
-- restoring one of those (RETIRED_COLUMNS), so old backups still restore.
--
-- Shipped in the SAME release as the code that stopped reading it (a deliberate choice).
-- Consequence: rolling the app back to a build from before that code would read a
-- column that no longer exists. Roll forward instead.
--
-- No CASCADE: if anything in the database still depended on the column (a view, a
-- function's row type), the drop should fail loudly here rather than take that
-- dependency down with it. As of this migration nothing does.
--
-- Idempotent: IF EXISTS makes a replay harmless.
-- ============================================================================

BEGIN;

ALTER TABLE public.tenures DROP COLUMN IF EXISTS name;

COMMIT;
