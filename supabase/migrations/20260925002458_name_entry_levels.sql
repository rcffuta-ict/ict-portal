-- ============================================================================
-- Name the two entry levels the way every handover now names them.
--
-- PDS/UABS members are aspirants, not yet students, and a new intake arrives every
-- session, so the foundation generation takes the ACTIVE session's name ("2028/2029").
-- 100 Level is named after its entry year ("2028 Set") when it has no name yet.
--
-- From now on the handover applies both (src/lib/handover-schedule.ts, resetEntryLevels).
-- This brings the generations that exist today into line once.
--
-- Data only, and safe to re-run: it recomputes the same names. With no active tenure,
-- or a session that doesn't start with a year, it changes nothing.
-- ============================================================================

BEGIN;

WITH active AS (
    SELECT session
    FROM public.tenures
    WHERE is_active
    LIMIT 1
)
UPDATE public.class_sets cs
SET family_name = active.session
FROM active
WHERE cs.is_foundation
  AND cs.family_name IS DISTINCT FROM active.session;

WITH active AS (
    SELECT substring(session FROM '^(\d{4})')::int AS start_year
    FROM public.tenures
    WHERE is_active
    LIMIT 1
)
UPDATE public.class_sets cs
SET family_name = active.start_year || ' Set'
FROM active
WHERE active.start_year IS NOT NULL
  AND NOT cs.is_foundation
  AND cs.entry_year = active.start_year
  AND (cs.family_name IS NULL OR btrim(cs.family_name) = '');

COMMIT;
