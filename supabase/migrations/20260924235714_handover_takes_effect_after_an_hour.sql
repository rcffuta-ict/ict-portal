-- ============================================================================
-- A completed handover takes effect an hour later.
--
-- WHY
--   Finishing the wizard used to switch tenures on the spot: every generation moved up,
--   the finalists became alumni and the outgoing cabinet lost access, all in one tap.
--   Now the last step SCHEDULES the switch for an hour later. During that hour the
--   outgoing cabinet can wrap up, and the VP Admin or System Admin can still cancel.
--
-- HOW IT RUNS
--   There is no job runner (Vercel's free cron runs once a day), so the app applies a due
--   handover the first time anyone uses it after the hour. That code is
--   src/lib/handover-schedule.ts. `applying` is how one request claims the switch, so
--   two requests arriving together can never run it twice.
--
-- NEW STATUSES
--   scheduled  the wizard is finished; the switch happens at `effective_at`
--   applying   claimed by one request, and the switch is running
--   failed     the switch was refused when it came due (the reason is in
--              `failure_reason`); nothing was changed, and a new handover can be started
--
-- NEW COLUMNS
--   effective_at   when the switch happens
--   plan           what the switch does, written by the server after checking it (the
--                  session, the start date, the two appointments and the two options).
--                  Unlike `payload`, which is the wizard's draft, this is what runs.
--   scheduled_*    who finished the wizard, and when. The switch runs in their name.
--   failure_reason why a due switch was refused
-- ============================================================================

BEGIN;

ALTER TABLE public.handover_intents
    ADD COLUMN IF NOT EXISTS effective_at      timestamptz,
    ADD COLUMN IF NOT EXISTS plan              jsonb,
    ADD COLUMN IF NOT EXISTS scheduled_at      timestamptz,
    ADD COLUMN IF NOT EXISTS scheduled_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS scheduled_by_name text,
    ADD COLUMN IF NOT EXISTS failure_reason    text;

ALTER TABLE public.handover_intents
    DROP CONSTRAINT IF EXISTS handover_intents_status_check;
ALTER TABLE public.handover_intents
    ADD CONSTRAINT handover_intents_status_check
    CHECK (status = ANY (ARRAY[
        'draft', 'in_progress', 'scheduled', 'applying', 'completed', 'abandoned', 'failed'
    ]));

-- A scheduled or applying handover is still OPEN: nobody may start a rival one for the
-- same tenure while it waits.
DROP INDEX IF EXISTS public.handover_intents_one_open;
CREATE UNIQUE INDEX handover_intents_one_open
    ON public.handover_intents (from_tenure_id)
    WHERE status IN ('draft', 'in_progress', 'scheduled', 'applying');

-- The due check runs on every request, so it must be a cheap lookup.
CREATE INDEX IF NOT EXISTS handover_intents_due_idx
    ON public.handover_intents (effective_at)
    WHERE status = 'scheduled';

COMMIT;
