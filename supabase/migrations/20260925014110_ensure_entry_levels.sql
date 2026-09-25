-- ============================================================================
-- Make sure both entry levels exist: PDS/UABS and 100 Level.
--
-- Every session has a PDS/UABS generation (aspirants, named after the session,
-- "2025/2026") and a 100 Level generation (named after its entry year, "2025 Set").
-- The handover creates and names them from now on (src/lib/handover-schedule.ts,
-- resetEntryLevels). 20260925002458_name_entry_levels only RENAMED what existed, and
-- production had no PDS/UABS generation at all, and a 100 Level called "100 level".
--
-- For the active session this:
--   1. Creates the PDS/UABS generation if there is none, keyed by the NEXT intake's
--      year (session start + 1, the convention in scripts/seed-staging.mjs) and named
--      after the session. Its year is only a key: a foundation generation is always
--      PDS/UABS.
--   2. Creates the 100 Level generation ("<start> Set") if there is none.
--   3. Names the 100 Level generation "<start> Set" when its name is empty or just
--      restates its level ("100 level", "100L"). A real family name is kept.
--
-- Data only. Safe to re-run. With no active tenure, it changes nothing.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_session text;
    v_start   int;
BEGIN
    SELECT session INTO v_session FROM public.tenures WHERE is_active LIMIT 1;
    v_start := substring(v_session FROM '^(\d{4})')::int;
    IF v_start IS NULL THEN
        RETURN;
    END IF;

    -- 1. PDS/UABS
    IF NOT EXISTS (SELECT 1 FROM public.class_sets WHERE is_foundation) THEN
        IF EXISTS (SELECT 1 FROM public.class_sets WHERE entry_year = v_start + 1) THEN
            RAISE NOTICE 'No PDS/UABS generation, and % is already taken; create it from the Generations tab.', v_start + 1;
        ELSE
            INSERT INTO public.class_sets (entry_year, family_name, is_foundation)
            VALUES (v_start + 1, v_session, true);
            RAISE NOTICE 'Created the PDS/UABS generation for %.', v_session;
        END IF;
    END IF;

    -- 2. 100 Level
    IF NOT EXISTS (SELECT 1 FROM public.class_sets WHERE entry_year = v_start) THEN
        INSERT INTO public.class_sets (entry_year, family_name, is_foundation)
        VALUES (v_start, v_start || ' Set', false);
        RAISE NOTICE 'Created 100 Level (% Set).', v_start;
    END IF;

    -- 3. A placeholder 100 Level name becomes "<start> Set".
    UPDATE public.class_sets
       SET family_name = v_start || ' Set'
     WHERE entry_year = v_start
       AND NOT is_foundation
       AND (family_name IS NULL
            OR btrim(family_name) = ''
            OR lower(btrim(family_name)) ~ '^100\s*(l|lvl|level)?$');
END $$;

COMMIT;
