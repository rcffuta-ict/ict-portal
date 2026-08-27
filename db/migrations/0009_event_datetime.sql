-- ============================================================================
-- Migration 0009 — `events.date` must keep the time of day.
--
-- THE BUG
--   `public.events.date` was declared `date` (base schema, line 49), so Postgres
--   threw away the time component of every value the admin modal sent. Saving an
--   event for 10:00 AM stored `2026-09-12`; reading it back gave the string
--   "2026-09-12", which `new Date()` parses as **UTC midnight**, and rendering
--   that in Africa/Lagos (UTC+1, no DST) printed **1:00 AM** on every event.
--   The client-side timezone bridging in `src/lib/event-utils.ts` was already
--   correct — the column simply could not hold what it was given.
--
-- WHAT CHANGES
--   `date` becomes `timestamptz`. Existing date-only rows are interpreted as
--   **Lagos midnight**, not UTC midnight — those rows never had a real time, and
--   Lagos midnight is the honest reading of "12 September" written by someone in
--   Akure. They will render as 12:00 AM until an admin sets a real time.
--   The default moves from CURRENT_DATE to now() for the same reason.
--
-- Ordering (`.order('date')` in src/app/events/actions.ts and
-- src/app/lo-app/actions.ts) is unaffected — timestamptz sorts the same way.
--
-- Safe to re-run: the type change is skipped if it has already been applied.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'events'
          AND column_name = 'date'
          AND data_type = 'date'
    ) THEN
        ALTER TABLE public.events ALTER COLUMN date DROP DEFAULT;

        ALTER TABLE public.events
            ALTER COLUMN date TYPE timestamptz
            USING (date::timestamp AT TIME ZONE 'Africa/Lagos');

        ALTER TABLE public.events ALTER COLUMN date SET DEFAULT now();
    END IF;
END
$$;

COMMENT ON COLUMN public.events.date IS
    'Event start instant. Written/read as Africa/Lagos wall-clock by src/lib/event-utils.ts.';
