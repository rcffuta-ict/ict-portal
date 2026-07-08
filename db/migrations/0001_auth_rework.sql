-- ============================================================================
-- Migration 0001 — Auth rework: leadership-only login, invite-only registration,
--                  RLS lockdown.
--
-- Apply against the Supabase project (SQL editor or `supabase db push`).
-- Idempotent where practical (IF NOT EXISTS / DROP ... IF EXISTS).
--
-- Context: Supabase Auth is retired. Authentication now lives in `profile_login`
-- + `auth_sessions` (opaque, hashed, DB-backed sessions) and is audited in
-- `login_events`. Profiles no longer reference auth.users. All portal DB access
-- goes through the service-role client (which BYPASSES RLS); RLS here is a
-- default-deny lockdown against the anon/publishable key.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. profiles — decouple from Supabase Auth
-- ----------------------------------------------------------------------------
-- Drop the FK to auth.users so profiles can exist without a Supabase Auth user.
-- Existing profile ids are preserved; new profiles get a fresh uuid.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Cloudinary public id, so we can delete/replace the remote asset later.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_public_id text;

-- ----------------------------------------------------------------------------
-- 2. leadership_positions — aliases + protected defaults
-- ----------------------------------------------------------------------------
-- alias: short name every leadership role has (e.g. "VP Admin").
-- is_default: the two bootstrap roles (VP Admin, ICT Coordinator) that may never
--             be disabled or deleted.
ALTER TABLE public.leadership_positions ADD COLUMN IF NOT EXISTS alias text;
ALTER TABLE public.leadership_positions
    ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 3. class_sets — mark PDS/UABS (foundation) generations
-- ----------------------------------------------------------------------------
-- A "level" is a generation (class_set) projected onto the active tenure:
-- entry-year progression gives 100..500 Level, EXCEPT foundation sets which are
-- always labelled "PDS/UABS".
ALTER TABLE public.class_sets
    ADD COLUMN IF NOT EXISTS is_foundation boolean NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 4. profile_login — who may log in (leaders only) + auth audit fields
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_login (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id      uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    password_hash   text NOT NULL,               -- scrypt$N$salt$hash (see src/lib/auth/password.ts)
    is_active       boolean NOT NULL DEFAULT true,
    granted_by      uuid REFERENCES public.profiles(id), -- VP Admin who provisioned login
    last_login_at   timestamptz,
    last_login_ip   text,
    failed_attempts integer NOT NULL DEFAULT 0,
    locked_until    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. auth_sessions — DB-backed, revocable sessions (opaque token hashed at rest)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token_hash   text NOT NULL UNIQUE,           -- sha256(raw cookie token); raw is never stored
    ip           text,
    user_agent   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    revoked_at   timestamptz,
    revoked_reason text,                          -- 'logout' | 'admin' | null (set when revoking)
    last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_profile_idx ON public.auth_sessions(profile_id);

-- ----------------------------------------------------------------------------
-- 6. login_events — append-only authentication audit log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_events (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    email      text,
    event      text NOT NULL CHECK (event = ANY (ARRAY[
                   'login_success','login_fail','logout','session_revoked'])),
    ip         text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_events_profile_idx ON public.login_events(profile_id);

-- ----------------------------------------------------------------------------
-- 6.1 Audit triggers — delegate deterministic login events to the DB
-- ----------------------------------------------------------------------------
-- The app only records `login_fail` (no session row exists on a failed attempt).
-- Everything else is derived from `auth_sessions` state changes, so the audit
-- trail can't be bypassed by a forgetful code path:
--   * INSERT a session      -> 'login_success'
--   * set revoked_at        -> 'logout' (user) or 'session_revoked' (admin/other)
-- IP + user-agent come from the session row; email is joined from profiles.

CREATE OR REPLACE FUNCTION public.audit_session_login()
RETURNS trigger AS $$
DECLARE
    v_email text;
BEGIN
    SELECT email INTO v_email FROM public.profiles WHERE id = NEW.profile_id;
    INSERT INTO public.login_events (profile_id, email, event, ip, user_agent)
    VALUES (NEW.profile_id, v_email, 'login_success', NEW.ip, NEW.user_agent);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.audit_session_revoke()
RETURNS trigger AS $$
DECLARE
    v_email text;
    v_event text;
BEGIN
    IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
        SELECT email INTO v_email FROM public.profiles WHERE id = NEW.profile_id;
        v_event := CASE WHEN NEW.revoked_reason = 'logout' THEN 'logout' ELSE 'session_revoked' END;
        INSERT INTO public.login_events (profile_id, email, event, ip, user_agent)
        VALUES (NEW.profile_id, v_email, v_event, NEW.ip, NEW.user_agent);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_session_login ON public.auth_sessions;
CREATE TRIGGER trg_audit_session_login
    AFTER INSERT ON public.auth_sessions
    FOR EACH ROW EXECUTE FUNCTION public.audit_session_login();

DROP TRIGGER IF EXISTS trg_audit_session_revoke ON public.auth_sessions;
CREATE TRIGGER trg_audit_session_revoke
    AFTER UPDATE ON public.auth_sessions
    FOR EACH ROW EXECUTE FUNCTION public.audit_session_revoke();

-- ----------------------------------------------------------------------------
-- 7. registration_invites -> moved to Phase 2 migration 0002_invites.sql
--    (kept out of this baseline so each phase owns its own SQL).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 8. zone_pastors — hall/zone pastors are NOT leadership positions
-- ----------------------------------------------------------------------------
-- Pastors are tracked here instead of in `leadership`, so they neither appear in
-- the leadership catalog nor implicitly gain portal login.
CREATE TABLE IF NOT EXISTS public.zone_pastors (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    zone_id    uuid NOT NULL REFERENCES public.residential_zones(id) ON DELETE CASCADE,
    tenure_id  uuid NOT NULL REFERENCES public.tenures(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (profile_id, zone_id, tenure_id)
);

-- ----------------------------------------------------------------------------
-- 9. membership_units — enforce "one UNIT per member per tenure" (teams unlimited)
-- ----------------------------------------------------------------------------
-- `type` lives on `units`, so a partial unique index can't express this; use a
-- trigger. Teams (type='TEAM') are unconstrained.
CREATE OR REPLACE FUNCTION public.enforce_single_unit_membership()
RETURNS trigger AS $$
DECLARE
    v_type text;
BEGIN
    SELECT type INTO v_type FROM public.units WHERE id = NEW.unit_id;

    IF v_type = 'UNIT' THEN
        IF EXISTS (
            SELECT 1
            FROM public.membership_units mu
            JOIN public.units u ON u.id = mu.unit_id
            WHERE mu.profile_id = NEW.profile_id
              AND mu.tenure_id = NEW.tenure_id
              AND u.type = 'UNIT'
              AND mu.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) THEN
            RAISE EXCEPTION 'Member already belongs to a unit for this tenure (only one unit allowed).';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_unit_membership ON public.membership_units;
CREATE TRIGGER trg_single_unit_membership
    BEFORE INSERT OR UPDATE ON public.membership_units
    FOR EACH ROW EXECUTE FUNCTION public.enforce_single_unit_membership();

-- ----------------------------------------------------------------------------
-- 10. Seed the two protected default leadership positions
-- ----------------------------------------------------------------------------
INSERT INTO public.leadership_positions (title, alias, category, description, is_active, is_default)
VALUES
    ('Vice President Administration', 'VP Admin', 'CENTRAL',
     'Administrative head; appoints leaders and manages leadership roles.', true, true),
    ('ICT Coordinator', 'ICT Coord', 'CENTRAL',
     'Coordinates the ICT department; full administrative access.', true, true)
ON CONFLICT (title) DO UPDATE
    SET alias = EXCLUDED.alias,
        is_default = true,
        is_active = true;

-- ----------------------------------------------------------------------------
-- 10.1 Profile / login context RPCs
-- ----------------------------------------------------------------------------
-- One round-trip resolves everything the app needs, avoiding N+1 lookups:
--   * rcf_profile_context(profile_id) -> the FullUserProfile-compatible shape
--     (camelCase, matching @rcffuta/ict-lib) PLUS enriched leadership/scope data
--     (unitId, classSetId, isDefault, isAdmin, isVpAdmin) that ict-lib doesn't expose.
--   * rcf_login_context(email) -> the auth gate (password_hash + login state) AND
--     the profile context. Password verification stays in Node (scrypt); the hash
--     is only ever returned to the trusted service-role caller.
-- SECURITY DEFINER + EXECUTE revoked from anon/authenticated: service-role only.

-- Level = generation projected onto the active tenure's session (e.g. entry 2023 in
-- session "2025/2026" -> 300 Level). Foundation sets are always "PDS/UABS".
-- NOTE: keep this in sync with computeLevel() in src/lib/levels.ts.
CREATE OR REPLACE FUNCTION public.rcf_compute_level(
    p_entry_year integer, p_is_foundation boolean, p_session text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN p_is_foundation THEN 'PDS/UABS'
        WHEN p_entry_year IS NULL OR p_session IS NULL OR p_session !~ '^\d{4}' THEN NULL
        WHEN (left(p_session, 4)::int - p_entry_year + 1) < 1 THEN 'Pre-100'
        WHEN (left(p_session, 4)::int - p_entry_year + 1) > 5 THEN 'Alumni'
        ELSE ((left(p_session, 4)::int - p_entry_year + 1) * 100)::text || ' Level'
    END;
$$;

CREATE OR REPLACE FUNCTION public.rcf_profile_context(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_tenure_id uuid;
    v_session   text;
    v_result    jsonb;
BEGIN
    SELECT id, session INTO v_tenure_id, v_session
    FROM public.tenures WHERE is_active LIMIT 1;

    SELECT jsonb_build_object(
        'profile', jsonb_build_object(
            'id', p.id,
            'firstName', p.first_name,
            'lastName', p.last_name,
            'middleName', p.middle_name,
            'email', p.email,
            'phoneNumber', p.phone_number,
            'gender', p.gender,
            'avatarUrl', p.avatar_url,
            'avatarPublicId', p.avatar_public_id
        ),
        'location', jsonb_build_object(
            'schoolAddress', p.school_address,
            'homeAddress', p.home_address,
            'residentialZone', rz.name
        ),
        'academics', jsonb_build_object(
            'matricNumber', p.matric_number,
            'department', p.department,
            'faculty', p.faculty,
            'entryYear', cs.entry_year,
            'family', cs.family_name,
            'currentLevel', public.rcf_compute_level(cs.entry_year, COALESCE(cs.is_foundation, false), v_session)
        ),
        'classSet', CASE WHEN cs.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', cs.id, 'entryYear', cs.entry_year, 'familyName', cs.family_name,
            'isFoundation', COALESCE(cs.is_foundation, false),
            'currentLevel', public.rcf_compute_level(cs.entry_year, COALESCE(cs.is_foundation, false), v_session)
        ) END,
        'roles', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'title', lp.title, 'scope', lp.category,
                'contextName', COALESCE(u.name, lcs.family_name, lrz.name)))
            FROM public.leadership l
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            LEFT JOIN public.units u ON u.id = l.unit_id
            LEFT JOIN public.class_sets lcs ON lcs.id = l.class_set_id
            LEFT JOIN public.residential_zones lrz ON lrz.id = l.residential_zone_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
        ), '[]'::jsonb),
        'leadership', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'leadershipId', l.id, 'positionId', l.position_id,
                'title', lp.title, 'alias', lp.alias, 'category', lp.category,
                'isDefault', lp.is_default, 'unitId', l.unit_id, 'unitName', u.name,
                'classSetId', l.class_set_id, 'residentialZoneId', l.residential_zone_id,
                'tenureId', l.tenure_id))
            FROM public.leadership l
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            LEFT JOIN public.units u ON u.id = l.unit_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
        ), '[]'::jsonb),
        'unit', (
            SELECT jsonb_build_object('id', u.id, 'name', u.name, 'role', mu.role)
            FROM public.membership_units mu
            JOIN public.units u ON u.id = mu.unit_id
            WHERE mu.profile_id = p.id AND u.type = 'UNIT'
              AND (v_tenure_id IS NULL OR mu.tenure_id = v_tenure_id)
            LIMIT 1
        ),
        'teams', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'role', mu.role))
            FROM public.membership_units mu
            JOIN public.units u ON u.id = mu.unit_id
            WHERE mu.profile_id = p.id AND u.type = 'TEAM'
              AND (v_tenure_id IS NULL OR mu.tenure_id = v_tenure_id)
        ), '[]'::jsonb),
        'isAdmin', EXISTS (
            SELECT 1 FROM public.leadership l
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND (lp.is_default OR lp.category = 'PRESIDENT')),
        'isVpAdmin', EXISTS (
            SELECT 1 FROM public.leadership l
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND lp.title = 'Vice President Administration')
    )
    INTO v_result
    FROM public.profiles p
    LEFT JOIN public.residential_zones rz ON rz.id = p.residential_zone_id
    LEFT JOIN public.class_sets cs ON cs.id = p.class_set_id
    WHERE p.id = p_profile_id;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rcf_login_context(p_email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_profile_id uuid;
    v_email      text;
    v_login      public.profile_login%ROWTYPE;
BEGIN
    SELECT id, email INTO v_profile_id, v_email
    FROM public.profiles WHERE lower(email) = lower(p_email) LIMIT 1;
    IF v_profile_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_login FROM public.profile_login WHERE profile_id = v_profile_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'profileId', v_profile_id,
        'email', v_email,
        'loginId', v_login.id,
        'passwordHash', v_login.password_hash,
        'isActive', v_login.is_active,
        'failedAttempts', v_login.failed_attempts,
        'lockedUntil', v_login.locked_until,
        'context', public.rcf_profile_context(v_profile_id)
    );
END;
$$;

-- These functions expose password hashes / PII; service-role only.
REVOKE EXECUTE ON FUNCTION public.rcf_login_context(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rcf_profile_context(uuid) FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. Row Level Security — enable + FORCE on every public table (default-deny)
-- ----------------------------------------------------------------------------
-- The service-role key bypasses RLS, so trusted server actions keep working.
-- The anon/publishable key gets nothing unless an explicit policy grants it.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END $$;

-- Narrow public policies ONLY for genuinely public surfaces the anon key needs.
-- Everything else (profiles, profile_login, auth_sessions, login_events,
-- registration_invites, leadership*, membership_*, zone_pastors, class_sets,
-- tenures, units, ...) stays deny-by-default → service-role only.

-- Public event pages: read active events.
DROP POLICY IF EXISTS "public read active events" ON public.events;
CREATE POLICY "public read active events" ON public.events
    FOR SELECT TO anon USING (is_active = true);

-- Public event registration form: allow inserts only.
DROP POLICY IF EXISTS "public insert event registrations" ON public.event_registrations;
CREATE POLICY "public insert event registrations" ON public.event_registrations
    FOR INSERT TO anon WITH CHECK (true);

-- lo-app (public Q&A): read visible questions + star them.
DROP POLICY IF EXISTS "public read visible questions" ON public.event_questions;
CREATE POLICY "public read visible questions" ON public.event_questions
    FOR SELECT TO anon USING (status = 'visible');

DROP POLICY IF EXISTS "public read question stars" ON public.question_stars;
CREATE POLICY "public read question stars" ON public.question_stars
    FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "public insert question stars" ON public.question_stars;
CREATE POLICY "public insert question stars" ON public.question_stars
    FOR INSERT TO anon WITH CHECK (true);

COMMIT;

-- ============================================================================
-- POST-MIGRATION (run manually, documented — not part of the transaction):
--
--  * Bootstrap the first VP Admin's login. Given a profile id and a scrypt hash
--    produced by src/lib/auth/password.ts:
--      INSERT INTO public.profile_login (profile_id, password_hash, granted_by)
--      VALUES ('<vp-admin-profile-id>', '<scrypt-hash>', '<vp-admin-profile-id>');
--    and assign them the VP Admin position for the active tenure via
--    admin.assignLeader / the leadership table.
--
--  * Verify the anon key cannot read auth tables (expect 0 rows / permission error):
--      set role anon;  select * from public.profile_login;   -- must fail/empty
--      reset role;
-- ============================================================================
