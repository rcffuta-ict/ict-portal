-- ============================================================================
-- Migration 0002 — Phase 2: invite-only registration + credential (reset) links.
--
-- Depends on 0001 (profiles, class_sets, profile_login). Apply after 0001.
--
-- registration_invites backs three flows:
--   'create' | 'update' -> level-coordinator links that add/edit a member in their
--                          generation (class_set_id set).
--   'reset'             -> a credential link issued by VP Admin / ICT Coordinator so a
--                          LEADER can (re)set their own password (target_profile_id set,
--                          class_set_id null). This is the "forgot password" path —
--                          admin-issued, leaders only.
--
-- RLS: this table is created AFTER 0001's blanket ENABLE/FORCE loop ran, so it must
-- enable + force RLS itself. Default-deny (no policies) → service-role access only.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.registration_invites (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token             text NOT NULL UNIQUE,
    class_set_id      uuid REFERENCES public.class_sets(id) ON DELETE CASCADE, -- null for 'reset'
    purpose           text NOT NULL DEFAULT 'create'
                          CHECK (purpose = ANY (ARRAY['create','update','reset'])),
    target_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,   -- 'update'/'reset'
    created_by        uuid NOT NULL REFERENCES public.profiles(id),            -- coordinator / admin
    is_active         boolean NOT NULL DEFAULT true,
    expires_at        timestamptz,
    use_count         integer NOT NULL DEFAULT 0,
    max_uses          integer,                    -- null = unlimited
    created_at        timestamptz NOT NULL DEFAULT now(),
    revoked_at        timestamptz
);

CREATE INDEX IF NOT EXISTS registration_invites_token_idx ON public.registration_invites(token);
CREATE INDEX IF NOT EXISTS registration_invites_class_set_idx ON public.registration_invites(class_set_id);
CREATE INDEX IF NOT EXISTS registration_invites_created_by_idx ON public.registration_invites(created_by);

-- Lock the table down (service-role only; the anon key never touches invites).
ALTER TABLE public.registration_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_invites FORCE ROW LEVEL SECURITY;

COMMIT;
