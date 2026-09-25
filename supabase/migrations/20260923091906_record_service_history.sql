-- ============================================================================
-- Service history: an appointment ENDS rather than disappearing
-- ============================================================================
--
-- THE PROBLEM
--
-- Removing a leader was `DELETE FROM leadership`, which destroys the only record that
-- the person ever held the office. A fellowship's institutional memory is exactly that
-- record -- "Welfare Coordinator (2025/2026), Director of Commerce (2026/2027)" is a
-- member's service, and it is the sort of thing somebody asks about at a handover, a
-- reference, or a testimonial years later. Past tenures survived only because nobody
-- had pressed Remove.
--
-- THE SHAPE
--
-- An appointment now ends instead of vanishing: `ended_at` is stamped, and the row
-- stays. A hard delete remains available for the genuine mistake -- appointed the wrong
-- person two minutes ago -- because a service record that includes appointments that
-- never happened is worse than no record at all. The admin chooses, and keeping the
-- history is the default.
--
-- WHAT "ENDED" MUST MEAN EVERYWHERE
--
-- An ended appointment confers NOTHING. This is the part that makes the change
-- security-relevant rather than cosmetic: `rcf_profile_context` builds the `privileges`
-- array that every authorization decision reads from `public.leadership`, filtered only
-- by profile and active tenure. Left alone, a leader removed from office would keep
-- their privileges -- the exact opposite of what pressing Remove is asking for.
--
-- So this migration does three things, and all three are required together:
--
--   1. The columns.
--   2. `leadership_one_lead_per_position` must ignore ended rows, or an office could
--      never be refilled after its holder stepped down.
--   3. `rcf_profile_context` must ignore ended rows in all six places it reads
--      leadership -- roles, leadership, isSysAdmin, isPresident, isVpAdmin, isAdmin.
--
-- Idempotent and re-runnable, like the rest of the series.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.leadership
    ADD COLUMN IF NOT EXISTS ended_at     timestamp with time zone,
    ADD COLUMN IF NOT EXISTS ended_by     uuid,
    ADD COLUMN IF NOT EXISTS ended_reason text;

-- ON DELETE SET NULL, not CASCADE: whoever ended an appointment may themselves leave
-- the fellowship, and that must not delete somebody else's service record.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leadership_ended_by_fkey'
    ) THEN
        ALTER TABLE public.leadership
            ADD CONSTRAINT leadership_ended_by_fkey
            FOREIGN KEY (ended_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN public.leadership.ended_at IS
    'When this appointment ended. NULL = currently held. An ended row is service history and confers no privileges.';

-- Reading a member's service across every tenure is the common query now.
CREATE INDEX IF NOT EXISTS leadership_profile_history_idx
    ON public.leadership (profile_id, tenure_id);

-- ----------------------------------------------------------------------------
-- 2. One lead per office -- among CURRENT holders
-- ----------------------------------------------------------------------------
--
-- The predicate was `WHERE is_lead`. With ended rows kept, that would mean an office
-- whose holder stepped down could never be filled again: the departed row still
-- occupies the unique slot. Ended appointments leave the index.
DROP INDEX IF EXISTS leadership_one_lead_per_position;

CREATE UNIQUE INDEX IF NOT EXISTS leadership_one_lead_per_position
    ON public.leadership (tenure_id, position_id)
    WHERE is_lead AND ended_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. rcf_profile_context -- ended appointments confer nothing
-- ----------------------------------------------------------------------------
--
-- Identical to 0013's definition except for `AND l.ended_at IS NULL`, added to every
-- one of the six reads of public.leadership. Replaced wholesale rather than patched
-- because a plpgsql body cannot be edited in place, and because the six filters must
-- land together -- five of six would leave a removed leader still counted an admin.
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
                'title', lp.title, 'slug', lp.slug,
                'scope', public.rcf_position_kind(lp.id),
                'contextName', COALESCE(u.name, lcs.family_name, lrz.name)))
            FROM public.leadership l
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            LEFT JOIN public.units u ON u.id = l.unit_id
            LEFT JOIN public.class_sets lcs ON lcs.id = l.class_set_id
            LEFT JOIN public.residential_zones lrz ON lrz.id = l.residential_zone_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND l.ended_at IS NULL
        ), '[]'::jsonb),
        'leadership', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'leadershipId', l.id, 'positionId', l.position_id,
                'title', lp.title, 'alias', lp.alias, 'slug', lp.slug,
                'category', public.rcf_position_kind(lp.id),
                'tier', lp.tier, 'isProtected', lp.is_protected,
                'unitId', l.unit_id, 'unitName', u.name,
                'classSetId', l.class_set_id, 'residentialZoneId', l.residential_zone_id,
                'tenureId', l.tenure_id,
                'privileges', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('tag', pp.privilege, 'scope', pp.scope))
                    FROM public.position_privileges pp WHERE pp.position_id = l.position_id
                ), '[]'::jsonb)))
            FROM public.leadership l
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            LEFT JOIN public.units u ON u.id = l.unit_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND l.ended_at IS NULL
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
        'isSysAdmin', EXISTS (
            SELECT 1 FROM public.leadership l
            JOIN public.position_privileges pp ON pp.position_id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND l.ended_at IS NULL
              AND pp.privilege = 'SYSADMIN'),
        'isPresident', EXISTS (
            SELECT 1 FROM public.leadership l
            JOIN public.position_privileges pp ON pp.position_id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND l.ended_at IS NULL
              AND pp.privilege = 'PRESIDENT'),
        'isVpAdmin', EXISTS (
            SELECT 1 FROM public.leadership l
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND l.ended_at IS NULL
              AND lp.slug = 'vp-admin'),
        'isAdmin', EXISTS (
            SELECT 1 FROM public.leadership l
            LEFT JOIN public.position_privileges pp ON pp.position_id = l.position_id
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND l.ended_at IS NULL
              AND (pp.privilege IN ('SYSADMIN','PRESIDENT')
                   OR lp.slug = 'vp-admin'))
    )
    INTO v_result
    FROM public.profiles p
    LEFT JOIN public.residential_zones rz ON rz.id = p.residential_zone_id
    LEFT JOIN public.class_sets cs ON cs.id = p.class_set_id
    WHERE p.id = p_profile_id;

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rcf_profile_context(uuid) FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Ledger
-- ----------------------------------------------------------------------------
INSERT INTO public.schema_migrations (id, version, name, applied_at, applied_by, notes)
VALUES ('0014', '1.1.0', 'record_service_history', now(), current_user,
        'leadership.ended_at/ended_by/ended_reason: removal ends an appointment rather '
        || 'than deleting it, so a member''s service across tenures survives. '
        || 'leadership_one_lead_per_position now ignores ended rows, or an office could '
        || 'never be refilled. rcf_profile_context ignores ended rows in ALL SIX of its '
        || 'leadership reads, so a removed leader loses their privileges.')
ON CONFLICT (id) DO UPDATE
    SET version = EXCLUDED.version,
        name    = EXCLUDED.name,
        notes   = EXCLUDED.notes;

COMMIT;
