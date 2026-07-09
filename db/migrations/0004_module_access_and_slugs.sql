-- ============================================================================
-- Migration 0004 — position slugs + runtime module access config.
--
-- Depends on 0001 (leadership_positions.alias/is_default, rcf_profile_context).
-- Apply after 0001–0003.
--
-- Adds two things the "segmented sidebar + data-driven access" work needs:
--
--   1. leadership_positions.slug — a stable, UNIQUE, app-immutable handle for each
--      position, derived from its alias. Access config references positions by slug
--      (not by title, which is editable and display-facing).
--
--   2. module_access — a per-module table declaring which positions may READ / WRITE
--      each Tool module (tenure | zones | workforce | level). Values in read_slugs /
--      write_slugs are EITHER a position slug OR a category token
--      (CENTRAL | UNIT | TEAM | LEVEL | ZONE | PRESIDENT). Managed at runtime by the
--      ICT Coordinator (see src/app/dashboard/settings). Admins (VP Admin / ICT Coord /
--      PRESIDENT scope) always bypass this config in app code.
--
-- RLS: module_access is created AFTER 0001's blanket ENABLE/FORCE loop, so it enables
-- + forces RLS itself. Default-deny (no policies) → service-role access only, matching
-- registration_invites in 0002.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. leadership_positions.slug — stable, unique, immutable (immutability enforced
--    in the app: slug is set on create and never sent on update).
-- ----------------------------------------------------------------------------
ALTER TABLE public.leadership_positions ADD COLUMN IF NOT EXISTS slug text;

-- Backfill from alias (preferred) or title: lowercase, non-alphanumeric -> '-'.
UPDATE public.leadership_positions
SET slug = NULLIF(
        trim(both '-' FROM regexp_replace(
            lower(COALESCE(NULLIF(alias, ''), title)), '[^a-z0-9]+', '-', 'g')),
        '')
WHERE slug IS NULL;

-- Canonical slugs for the two protected defaults (referenced by seeded config below).
UPDATE public.leadership_positions SET slug = 'vp-admin'
WHERE title = 'Vice President Administration';
UPDATE public.leadership_positions SET slug = 'ict-coord'
WHERE title = 'ICT Coordinator';

-- De-duplicate any collisions by appending a positional counter.
WITH dupes AS (
    SELECT id,
           row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
    FROM public.leadership_positions
)
UPDATE public.leadership_positions p
SET slug = p.slug || '-' || dupes.rn
FROM dupes
WHERE p.id = dupes.id AND dupes.rn > 1;

-- Fallback for any still-empty slug (title was blank / non-alphanumeric).
UPDATE public.leadership_positions
SET slug = 'position-' || left(id::text, 8)
WHERE slug IS NULL OR slug = '';

ALTER TABLE public.leadership_positions ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leadership_positions_slug_key
    ON public.leadership_positions (slug);

-- ----------------------------------------------------------------------------
-- 2. module_access — per-module read/write config.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.module_access (
    module      text PRIMARY KEY
                    CHECK (module = ANY (ARRAY['tenure','zones','workforce','level'])),
    read_slugs  text[]  NOT NULL DEFAULT '{}',
    write_slugs text[]  NOT NULL DEFAULT '{}',
    write_scope text    NOT NULL DEFAULT 'ALL'
                    CHECK (write_scope = ANY (ARRAY['ALL','OWN'])),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  uuid REFERENCES public.profiles(id)
);

-- Service-role only (no policies); mirrors 0002's registration_invites lockdown.
ALTER TABLE public.module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_access FORCE ROW LEVEL SECURITY;

-- Seed default access per product spec.
INSERT INTO public.module_access (module, read_slugs, write_slugs, write_scope) VALUES
    ('tenure',    ARRAY['CENTRAL'],                                ARRAY['vp-admin'],                'ALL'),
    ('zones',     ARRAY['CENTRAL','UNIT','TEAM','LEVEL','ZONE'],   ARRAY['hall-rep-coord'],          'ALL'),
    ('workforce', ARRAY['CENTRAL','UNIT','TEAM'],                  ARRAY['unit-coord','team-coord'], 'OWN'),
    ('level',     ARRAY['CENTRAL','LEVEL'],                        ARRAY['level-coord'],             'OWN')
ON CONFLICT (module) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. rcf_profile_context — expose position slug alongside alias in each leadership
--    row. Reproduces 0001's function verbatim with a single added field.
--    Keep in sync with 0001; only the marked line differs.
-- ----------------------------------------------------------------------------
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
                'title', lp.title, 'alias', lp.alias, 'slug', lp.slug, 'category', lp.category, -- 0004: added slug
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

REVOKE EXECUTE ON FUNCTION public.rcf_profile_context(uuid) FROM anon, authenticated;

COMMIT;
