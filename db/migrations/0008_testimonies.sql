-- ============================================================================
-- Migration 0008 — Testimonies in the Lo! app.
--
-- Depends on 0001 (profiles, auth_sessions) and the base schema (events).
--
-- WHAT CHANGES
--   1. `testimonies` — a member posts what God did; a moderator approves it BEFORE
--      it becomes public, the way testimonies are vetted before being shared in a
--      service. Approved testimonies get their own shareable page, so the row keeps
--      a `share_count` and an author-name snapshot (the display name must survive
--      the profile being edited or removed).
--   2. `testimony_amens` — one "Amen" per member per testimony.
--   3. `lo_member_links` — MEMBER RECOGNITION, NOT AUTHENTICATION. Lo! is open to
--      anyone without a login, but only members may post a testimony. Only leaders
--      have `profile_login` rows, so membership is instead confirmed against the
--      `profiles` roster (matric number or email + surname) and remembered with an
--      opaque token: raw token in an httpOnly cookie, sha256 in the DB, revocable —
--      the same shape as `auth_sessions`. A link NEVER grants portal or admin access.
--   4. `lo_member_verify_attempts` — the roster lookup above is a public endpoint,
--      so attempts are logged and rate-limited per client.
--
-- RLS: enabled + forced with no policies → service-role only, matching 0007. All
-- reads/writes go through server actions that enforce their own authorization.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. testimonies
-- ----------------------------------------------------------------------------
-- `author_profile_id` is nullable ON DELETE SET NULL: a testimony outlives the
-- profile that posted it, which is exactly why `author_name` is snapshotted.
CREATE TABLE IF NOT EXISTS public.testimonies (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title                   text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
    body                    text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 20 AND 5000),
    category                text NOT NULL DEFAULT 'other' CHECK (category = ANY (ARRAY[
                                'healing', 'provision', 'academics', 'salvation',
                                'protection', 'family', 'answered_prayer', 'other'])),
    scripture_reference     text,

    author_profile_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name             text NOT NULL,
    -- Hides the name from the public feed only; moderators still see who posted.
    is_anonymous            boolean NOT NULL DEFAULT false,

    -- Optional link to the programme where it happened.
    event_id                uuid REFERENCES public.events(id) ON DELETE SET NULL,

    status                  text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY[
                                'pending', 'approved', 'rejected', 'hidden'])),
    reviewed_by_profile_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at             timestamptz,
    -- Shown back to the poster when a testimony is rejected.
    review_note             text,
    published_at            timestamptz,

    share_count             integer NOT NULL DEFAULT 0,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- The public feed is "approved, newest first"; the review queue is "pending, oldest
-- first". Both are covered here.
CREATE INDEX IF NOT EXISTS testimonies_status_published_idx
    ON public.testimonies (status, published_at DESC);
CREATE INDEX IF NOT EXISTS testimonies_status_created_idx
    ON public.testimonies (status, created_at);
CREATE INDEX IF NOT EXISTS testimonies_author_idx
    ON public.testimonies (author_profile_id);
CREATE INDEX IF NOT EXISTS testimonies_event_idx
    ON public.testimonies (event_id);

-- ----------------------------------------------------------------------------
-- 2. testimony_amens
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.testimony_amens (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    testimony_id uuid NOT NULL REFERENCES public.testimonies(id) ON DELETE CASCADE,
    profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT testimony_amens_unique_per_member UNIQUE (testimony_id, profile_id)
);

CREATE INDEX IF NOT EXISTS testimony_amens_testimony_idx
    ON public.testimony_amens (testimony_id);

-- ----------------------------------------------------------------------------
-- 3. lo_member_links — recognition tokens (NOT logins)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lo_member_links (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- sha256 of the cookie value; the raw token is never stored.
    token_hash   text NOT NULL UNIQUE,
    user_agent   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS lo_member_links_profile_idx
    ON public.lo_member_links (profile_id);

-- ----------------------------------------------------------------------------
-- 4. lo_member_verify_attempts — rate limiting for the public roster lookup
-- ----------------------------------------------------------------------------
-- `client_hash` is a hash of the caller's IP + user agent: enough to throttle a
-- guessing run without storing an address.
CREATE TABLE IF NOT EXISTS public.lo_member_verify_attempts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_hash  text NOT NULL,
    identifier   text,
    succeeded    boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lo_member_verify_attempts_client_idx
    ON public.lo_member_verify_attempts (client_hash, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Atomic share counter
-- ----------------------------------------------------------------------------
-- Read-modify-write from the app would lose counts when a testimony is shared by
-- several people at once, so the increment happens in one statement.
CREATE OR REPLACE FUNCTION public.increment_testimony_share(p_testimony_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.testimonies
       SET share_count = share_count + 1
     WHERE id = p_testimony_id
       AND status = 'approved'
    RETURNING share_count;
$$;

-- ----------------------------------------------------------------------------
-- 6. updated_at maintenance
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_testimony_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS testimonies_touch_updated_at ON public.testimonies;
CREATE TRIGGER testimonies_touch_updated_at
    BEFORE UPDATE ON public.testimonies
    FOR EACH ROW EXECUTE FUNCTION public.touch_testimony_updated_at();

-- ----------------------------------------------------------------------------
-- 7. RLS: default-deny (service-role only)
-- ----------------------------------------------------------------------------
ALTER TABLE public.testimonies                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonies                FORCE ROW LEVEL SECURITY;
ALTER TABLE public.testimony_amens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimony_amens            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lo_member_links            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lo_member_links            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lo_member_verify_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lo_member_verify_attempts  FORCE ROW LEVEL SECURITY;

COMMIT;
