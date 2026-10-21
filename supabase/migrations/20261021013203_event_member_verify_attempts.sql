-- ============================================================================
-- Members-only (exclusive) event registration: the attempt log.
--
-- An exclusive event takes registrations only from fellowship members. Most members
-- have no portal login, so a member proves who they are with their generation's level
-- token plus the email on their record (src/lib/event-member.ts). That is
-- recognition, not authentication -- the same trade-off as Lo! and the academics
-- round page -- so every attempt is logged here and failures are rate-limited.
--
-- Same shape as lo_member_verify_attempts and academic_submit_attempts.
-- RLS enabled and forced, no policies. Safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_member_verify_attempts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_hash  text NOT NULL,
    event_id     uuid REFERENCES public.events(id) ON DELETE CASCADE,
    identifier   text,
    succeeded    boolean NOT NULL DEFAULT false,
    created_at   timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_member_verify_attempts IS
    'Every level-token + email check on a members-only event registration. Failures are rate-limited per client.';

CREATE INDEX IF NOT EXISTS event_member_verify_attempts_client_idx
    ON public.event_member_verify_attempts (client_hash, created_at DESC);

ALTER TABLE public.event_member_verify_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_member_verify_attempts FORCE ROW LEVEL SECURITY;

COMMIT;
