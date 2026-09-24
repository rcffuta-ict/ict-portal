-- ============================================================================
-- Two ReadWrite functions leaked into the portal's baseline — remove them where
-- ReadWrite itself is absent
-- ============================================================================
--
-- The production database is shared by five applications. The baseline is meant to
-- hold the portal and nothing else (docs/DATABASE-CICD.md: "this repo does not quietly
-- version-control another app's schema"), and scripts/bootstrap-supabase.mjs filters
-- the others out by table prefix — rw_*, fyb_*, elib_*, the games.
--
-- generate_order_ref() and generate_verdict_ref() belong to ReadWrite, but their NAMES
-- carry no rw_ prefix, so the filter kept them while removing the rw_orders table and
-- rw_verdict_seq sequence they use. In any database built from this repo (CI, staging)
-- they reference objects that do not exist, and `supabase db lint` fails the build.
--
-- THE RULE, applied per object: drop the function only where the ReadWrite object it
-- depends on is ABSENT. In production, where ReadWrite's tables live, both checks find
-- them and nothing is touched — this migration never alters another application's
-- live code. It only stops the portal's own schema from carrying ReadWrite's.
--
-- Idempotent: DROP FUNCTION IF EXISTS, behind an existence check.
-- ============================================================================

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.rw_orders') IS NULL THEN
        DROP FUNCTION IF EXISTS public.generate_order_ref();
        RAISE NOTICE 'Dropped generate_order_ref(): ReadWrite (rw_orders) is not in this database.';
    ELSE
        RAISE NOTICE 'Kept generate_order_ref(): ReadWrite lives in this database.';
    END IF;

    IF to_regclass('public.rw_verdict_seq') IS NULL THEN
        DROP FUNCTION IF EXISTS public.generate_verdict_ref();
        RAISE NOTICE 'Dropped generate_verdict_ref(): ReadWrite (rw_verdict_seq) is not in this database.';
    ELSE
        RAISE NOTICE 'Kept generate_verdict_ref(): ReadWrite lives in this database.';
    END IF;
END $$;

COMMIT;
