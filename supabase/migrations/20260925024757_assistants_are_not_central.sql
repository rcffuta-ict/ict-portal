-- ============================================================================
-- Assistants to a central office are not central.
--
-- Access tags belong to an OFFICE, and every holder of the office has so far held all
-- of them, lead and assistants alike. For CENTRAL (church-wide read access) that is
-- wrong: if the Bible Study Secretary is central, their assistants are not. They still
-- serve in the office and keep its other tags (EXCO, LEVEL, ZONE...); only the
-- church-wide reach is the lead's alone.
--
-- Everything the app decides about a signed-in person comes from rcf_profile_context:
-- module access, "sees every unit / level", events, the Central badge. So this is the
-- one place to make the change:
--   1. an assistant's `privileges` list leaves out CENTRAL;
--   2. `roles[].scope` and `leadership[].category` are worked out per HOLDER
--      (rcf_holder_kind), so an assistant is not labelled Central either.
-- The rest of the function is copied unchanged from 20260923091906.
--
-- SYSADMIN, PRESIDENT and the VP Admin checks are unchanged: those offices have no
-- assistants (the app forces them to lead), and this is only about CENTRAL.
-- Nothing is stored; each session sees the change the next time it loads its context.
-- ============================================================================

BEGIN;

-- What a holder of this office is, given whether they lead it. Identical to
-- rcf_position_kind() except that a CENTRAL tag only counts for the lead.
CREATE OR REPLACE FUNCTION public.rcf_holder_kind(p_position_id uuid, p_is_lead boolean)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM public.position_privileges
                      WHERE position_id = p_position_id AND privilege = 'PRESIDENT')
            THEN 'PRESIDENT'
        WHEN EXISTS (SELECT 1 FROM public.position_privileges
                      WHERE position_id = p_position_id
                        AND (privilege = 'SYSADMIN'
                             OR (privilege = 'CENTRAL' AND COALESCE(p_is_lead, true))))
            THEN 'CENTRAL'
        WHEN EXISTS (SELECT 1 FROM public.position_privileges
                      WHERE position_id = p_position_id AND privilege = 'LEVEL')
            THEN 'LEVEL'
        WHEN EXISTS (SELECT 1 FROM public.position_privileges
                      WHERE position_id = p_position_id AND privilege = 'ZONE')
            THEN 'ZONE'
        WHEN EXISTS (SELECT 1 FROM public.position_privileges pp
                       JOIN public.units u ON u.slug = pp.scope
                      WHERE pp.position_id = p_position_id
                        AND pp.privilege = 'EXCO' AND u.type = 'TEAM')
            THEN 'TEAM'
        ELSE 'UNIT'
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.rcf_holder_kind(uuid, boolean) FROM anon, authenticated;

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
                'scope', public.rcf_holder_kind(lp.id, l.is_lead),
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
                'category', public.rcf_holder_kind(lp.id, l.is_lead),
                'tier', lp.tier, 'isProtected', lp.is_protected,
                'unitId', l.unit_id, 'unitName', u.name,
                'classSetId', l.class_set_id, 'residentialZoneId', l.residential_zone_id,
                'tenureId', l.tenure_id,
                'privileges', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('tag', pp.privilege, 'scope', pp.scope))
                    FROM public.position_privileges pp
                    WHERE pp.position_id = l.position_id
                      -- CENTRAL belongs to the lead. An assistant keeps every other tag.
                      AND (l.is_lead OR pp.privilege <> 'CENTRAL')
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

COMMIT;
