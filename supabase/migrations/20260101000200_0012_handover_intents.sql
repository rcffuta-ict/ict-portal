-- ============================================================================
-- Migration 0012 — Handover intents: a resumable, accountable record of every
-- attempt to hand a tenure over.
--
-- Depends on 0001 (profiles, tenures) and 0011 (the handover flow itself).
--
-- WHY
--   A handover is a long, deliberate, once-a-year procedure with six steps, and the
--   person running it will be interrupted — by a meeting, a flat battery, a question
--   they need to go and ask. Before this, closing the tab lost everything: the session
--   they'd settled on, the two appointments, the decisions about membership and access.
--
--   It is also the most consequential act in the system, and the people most affected
--   by it — the incoming cabinet — arrive AFTER it happens. An intent is the record
--   they inherit: who handed over, when, what they chose, and what they chose not to
--   do. Successors can read their predecessors' proceedings instead of guessing.
--
-- TWO TABLES
--   handover_intents  — one row per attempt. Carries the wizard's accumulated state in
--                       `payload` so it can be resumed exactly where it was left, plus
--                       the outcome once it lands.
--   handover_events   — an append-only log of what happened during that attempt. The
--                       intent tells you where things stand; the events tell you how it
--                       got there, including the steps someone went back and changed.
--
-- ON `payload`
--   Deliberately jsonb rather than columns. It is wizard draft state — a half-filled
--   form — and it will change shape as the wizard does. Nothing authoritative is read
--   from it: the committed outcome is recorded in real columns below, and the handover
--   action re-validates everything server-side regardless of what the draft holds.
--
-- Safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.handover_intents (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The tenure being closed. Kept even if that tenure is later removed, so the
    -- historical record doesn't quietly lose its subject.
    from_tenure_id uuid REFERENCES public.tenures(id) ON DELETE SET NULL,
    from_tenure_name text,
    from_tenure_session text,

    -- Set only once the handover actually completes.
    to_tenure_id   uuid REFERENCES public.tenures(id) ON DELETE SET NULL,

    status         text NOT NULL DEFAULT 'draft'
                       CHECK (status = ANY (ARRAY['draft','in_progress','completed','abandoned'])),

    -- Wizard resume state.
    step           smallint NOT NULL DEFAULT 0,
    payload        jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Accountability. Names are SNAPSHOTS so the trail survives a profile being edited
    -- or removed — years later, "who did this" must still answer.
    initiated_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    initiated_by_name text,
    completed_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    completed_by_name text,
    completed_at   timestamptz,
    abandoned_reason text,

    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- At most ONE open intent per outgoing tenure. Two people running a handover of the
-- same tenure side by side is precisely the race this table exists to prevent; the
-- second person joins the first one's intent instead of starting a rival draft.
CREATE UNIQUE INDEX IF NOT EXISTS handover_intents_one_open
    ON public.handover_intents (from_tenure_id)
    WHERE status IN ('draft', 'in_progress');

CREATE INDEX IF NOT EXISTS handover_intents_recent_idx
    ON public.handover_intents (created_at DESC);

-- ----------------------------------------------------------------------------
-- The proceedings log. Append-only by convention: nothing in the app updates or
-- deletes these rows, because an accountability trail you can edit isn't one.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.handover_events (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_id  uuid NOT NULL REFERENCES public.handover_intents(id) ON DELETE CASCADE,
    action     text NOT NULL,
    -- Human-readable summary of the action, rendered straight into the timeline.
    detail     text,
    actor_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS handover_events_intent_idx
    ON public.handover_events (intent_id, created_at);

-- Keep `updated_at` honest without every caller having to remember it.
CREATE OR REPLACE FUNCTION public.touch_handover_intent()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_handover_intent ON public.handover_intents;
CREATE TRIGGER trg_touch_handover_intent
    BEFORE UPDATE ON public.handover_intents
    FOR EACH ROW EXECUTE FUNCTION public.touch_handover_intent();

-- RLS enabled + FORCED with no policies → service-role only, matching 0007/0008/0010.
-- Every read and write goes through server actions that enforce VP Admin / System Admin.
ALTER TABLE public.handover_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_intents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.handover_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_events FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.handover_intents IS
    'One row per handover attempt: resumable wizard state plus the outcome. Read by successors as the record of what their predecessors did.';
COMMENT ON TABLE public.handover_events IS
    'Append-only proceedings log for a handover attempt.';

COMMIT;
