-- ============================================================================
-- Migration 0010 — `admin_audit_log`: a trail for System Admin edits to member data.
--
-- Depends on 0001 (profiles, RLS default-deny posture).
--
-- WHY
--   The Oracle page (/dashboard/oracle) lets ONE person — the System Admin — edit
--   any member's record through the service-role client, which bypasses RLS. That is
--   a necessary capability (someone has to be able to fix a wrong phone number), but
--   an unlogged one is indistinguishable from a compromised session. Every field the
--   admin changes writes a row here: who, whom, which field, from what, to what, when.
--
-- ONE ROW PER FIELD, not per save. A save that touches three fields writes three rows,
-- so "what happened to this member's phone number" is a single indexed lookup rather
-- than a scan through JSON blobs.
--
-- SENSITIVITY
--   `old_value` / `new_value` hold copies of the edited data — phone numbers, home
--   addresses, next-of-kin. This table is therefore exactly as sensitive as `profiles`
--   and must never be given a laxer policy than the default-deny below. It is read
--   only by getAuditTrail(), which is itself SysAdmin/President gated.
--
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The actor is NOT ON DELETE CASCADE: removing a leader's profile must never
    -- quietly erase the record of what they changed.
    actor_profile_id  uuid NOT NULL REFERENCES public.profiles(id),
    actor_name        text,
    target_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Snapshot of who was edited, so the trail survives the target being removed.
    target_name       text,
    action            text NOT NULL,
    field             text,
    old_value         text,
    new_value         text,
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- "What has been done to this member?" and "what has this admin done?" are the only
-- two questions the UI asks, both newest-first.
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
    ON public.admin_audit_log (target_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
    ON public.admin_audit_log (actor_profile_id, created_at DESC);

-- RLS enabled + FORCED with no policies → service-role only, matching 0007/0008.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_audit_log IS
    'One row per field changed by a System Admin via /dashboard/oracle. Service-role only; as sensitive as profiles.';
