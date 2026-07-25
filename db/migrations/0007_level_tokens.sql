-- ============================================================================
-- Migration 0007 — Level tokens + invite activity log.
--
-- Depends on 0002 (registration_invites) and 0001 (profiles, class_sets).
--
-- WHAT CHANGES
--   1. A new invite purpose, 'level'. A LEVEL TOKEN belongs to a generation, not to a
--      person: one token backs BOTH flows. The link is built from the token at share
--      time (`/register?invite=<token>&reason=register|update`), so the token itself is
--      a plain shareable string usable anywhere (posters, WhatsApp, another app).
--      'create'/'update' rows from 0002 keep working — they are per-purpose links.
--   2. `invite_events` — an append-only log of what was actually DONE with a token
--      (generated / revoked / register / update), including who did it (name + email
--      snapshot, so the log stays readable even if the profile is later edited).
--
-- RLS: default-deny (no policies) → service-role only, matching 0002.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Allow the 'level' purpose
-- ----------------------------------------------------------------------------
ALTER TABLE public.registration_invites
    DROP CONSTRAINT IF EXISTS registration_invites_purpose_check;

ALTER TABLE public.registration_invites
    ADD CONSTRAINT registration_invites_purpose_check
    CHECK (purpose = ANY (ARRAY['create', 'update', 'reset', 'level']));

-- A short, human-readable label kept for historical rows / future use.
ALTER TABLE public.registration_invites ADD COLUMN IF NOT EXISTS label text;

-- ONE ACTIVE TOKEN PER LEVEL. The generation has a single live token that everything
-- (registration, updates, anything shared elsewhere) is derived from; rotating it means
-- revoking the old one first. Enforced in the DB so a double-click or a second
-- coordinator acting at the same time can't leave two live tokens on one level.
CREATE UNIQUE INDEX IF NOT EXISTS registration_invites_one_active_level_token
    ON public.registration_invites (class_set_id)
    WHERE purpose = 'level' AND is_active;

-- ----------------------------------------------------------------------------
-- 2. invite_events — append-only activity log
-- ----------------------------------------------------------------------------
-- `profile_id` is nullable and ON DELETE SET NULL: the log must survive the profile it
-- refers to, which is exactly why the name/email are snapshotted alongside it.
CREATE TABLE IF NOT EXISTS public.invite_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_id   uuid NOT NULL REFERENCES public.registration_invites(id) ON DELETE CASCADE,
    action      text NOT NULL CHECK (action = ANY (ARRAY[
                    'generated', 'revoked', 'register', 'update'])),
    profile_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name  text,                       -- snapshot: who did it
    actor_email text,                       -- snapshot: their email at the time
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invite_events_invite_idx ON public.invite_events(invite_id);
CREATE INDEX IF NOT EXISTS invite_events_created_idx ON public.invite_events(created_at DESC);

ALTER TABLE public.invite_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_events FORCE ROW LEVEL SECURITY;

COMMIT;
