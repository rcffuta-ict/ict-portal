-- ============================================================================
-- Migration 0006 — Privilege-tag access model (keystone).
--
-- Depends on 0001–0005. Moves authorization from "position slug + category" tokens
-- to PRIVILEGE TAGS with scopes, assigned to a leadership position by the VP Admin:
--
--   Tags: EXCO | ZONE | LEVEL | CENTRAL | PRESIDENT | SYSADMIN
--     * EXCO      — scope = a unit/team SLUG (e.g. 'bible-study'). No scope = ALL
--                   (central-equivalent, church-wide). Confirmed literal semantics.
--     * LEVEL     — scope = a level token ('100'..'500' | 'pds-uabs'). No scope = ALL.
--                   'level:100' resolves at runtime to the generation that is CURRENTLY
--                   100 Level for the active session (not a pinned class_set).
--     * ZONE      — 'zone:all' only for now (central-equivalent).
--     * CENTRAL   — exco:all + level:all + zone:all → read-only on every module EXCEPT
--                   Settings. No write (Central users don't get the write-bypass).
--     * PRESIDENT — supreme + EXCLUSIVE (holds no other tag). Sees everything incl.
--                   Settings, but is GLOBALLY write-blocked (enforced in app resolvers).
--     * SYSADMIN  — manages the entire system: full read+write everywhere incl. Settings.
--                   Permanently tied to the ICT Coordinator. May ALSO carry a scoped EXCO.
--
-- This migration lands ONLY the data model + RPC. The legacy `category` / `is_central`
-- columns are intentionally LEFT IN PLACE so the current cabinet/tenure UI keeps working
-- until it is rebuilt to consume privileges (later phases).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. position_privileges — the privilege tags (+ optional scope) held by a position.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.position_privileges (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id uuid NOT NULL REFERENCES public.leadership_positions(id) ON DELETE CASCADE,
    privilege   text NOT NULL
                    CHECK (privilege = ANY (ARRAY['EXCO','ZONE','LEVEL','CENTRAL','PRESIDENT','SYSADMIN'])),
    -- Scope meaning depends on the tag: EXCO → unit/team slug; LEVEL → level token
    -- ('100'..'500' | 'pds-uabs'); everything else → NULL. NULL scope = "all".
    scope       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    -- A tag with a given scope is held at most once per position. Distinct NULLs are
    -- allowed by the UNIQUE index, so guard un-scoped duplicates separately below.
    UNIQUE (position_id, privilege, scope)
);
CREATE INDEX IF NOT EXISTS position_privileges_position_idx
    ON public.position_privileges (position_id);
-- Only one un-scoped row per (position, privilege) — UNIQUE treats NULLs as distinct.
CREATE UNIQUE INDEX IF NOT EXISTS position_privileges_unscoped_key
    ON public.position_privileges (position_id, privilege)
    WHERE scope IS NULL;

-- Service-role only (no policies); mirrors module_access / registration_invites.
ALTER TABLE public.position_privileges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_privileges FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Structural rules, DB-enforced (per the storage decision):
--      * a position may not hold both EXCO and LEVEL
--      * PRESIDENT is exclusive — it may not coexist with any other tag
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_position_privilege_rules()
RETURNS trigger AS $$
DECLARE
    v_tags text[];
BEGIN
    SELECT array_agg(DISTINCT privilege) INTO v_tags
    FROM public.position_privileges
    WHERE position_id = NEW.position_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    v_tags := COALESCE(v_tags, ARRAY[]::text[]) || NEW.privilege;

    IF ('EXCO' = ANY (v_tags)) AND ('LEVEL' = ANY (v_tags)) THEN
        RAISE EXCEPTION 'A position cannot hold both EXCO and LEVEL privileges.';
    END IF;

    IF ('PRESIDENT' = ANY (v_tags)) AND (array_length(array(
            SELECT DISTINCT unnest(v_tags) EXCEPT SELECT 'PRESIDENT'), 1) > 0) THEN
        RAISE EXCEPTION 'PRESIDENT is exclusive and cannot be combined with other privileges.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_position_privilege_rules ON public.position_privileges;
CREATE TRIGGER trg_position_privilege_rules
    BEFORE INSERT OR UPDATE ON public.position_privileges
    FOR EACH ROW EXECUTE FUNCTION public.enforce_position_privilege_rules();

-- ----------------------------------------------------------------------------
-- 3. units.slug — stable handle used as the EXCO scope (e.g. Exco:bible-study).
--    Backfill mirrors leadership_positions.slug in migration 0004.
-- ----------------------------------------------------------------------------
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.units
SET slug = NULLIF(
        trim(both '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')),
        '')
WHERE slug IS NULL;

-- De-duplicate collisions with a positional counter.
WITH dupes AS (
    SELECT id, row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
    FROM public.units
)
UPDATE public.units u
SET slug = u.slug || '-' || dupes.rn
FROM dupes
WHERE u.id = dupes.id AND dupes.rn > 1;

-- Fallback for any still-empty slug.
UPDATE public.units
SET slug = 'unit-' || left(id::text, 8)
WHERE slug IS NULL OR slug = '';

ALTER TABLE public.units ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS units_slug_key ON public.units (slug);

-- ----------------------------------------------------------------------------
-- 4. Backfill position_privileges from the legacy columns (only unambiguous ones).
-- ----------------------------------------------------------------------------
-- The ICT Coordinator is the System Admin.
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'SYSADMIN', NULL FROM public.leadership_positions WHERE slug = 'ict-coord'
ON CONFLICT DO NOTHING;

-- PRESIDENT-category positions become the exclusive PRESIDENT tag.
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'PRESIDENT', NULL FROM public.leadership_positions
WHERE category = 'PRESIDENT' AND slug <> 'ict-coord'
ON CONFLICT DO NOTHING;

-- Central-by-nature positions (incl. VP Admin) become CENTRAL — but never the
-- System Admin (ict-coord) nor a President (PRESIDENT is exclusive).
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'CENTRAL', NULL FROM public.leadership_positions
WHERE is_central = true AND slug <> 'ict-coord' AND category <> 'PRESIDENT'
ON CONFLICT DO NOTHING;

-- LEVEL-category positions become the LEVEL tag, un-scoped (= all). The VP Admin
-- should re-scope these to a specific level token in the cabinet UI (later phase).
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'LEVEL', NULL FROM public.leadership_positions
WHERE category = 'LEVEL'
ON CONFLICT DO NOTHING;

-- NOTE: category IN ('UNIT','TEAM') positions are DELIBERATELY not auto-tagged. The
-- unit slug can't be inferred from the position alone, and an un-scoped EXCO would
-- wrongly grant church-wide access. The Workforce module is not yet live, so nothing
-- depends on this; the VP Admin assigns scoped Exco (Exco:<slug>) in the cabinet UI.

-- ----------------------------------------------------------------------------
-- 5. Re-seed module_access with PRIVILEGE-TAG tokens (replacing slug/category tokens).
--    Only the four CONFIGURABLE tags appear here; PRESIDENT/SYSADMIN/VP-Admin access is
--    handled by app-side bypass rules, and Settings is not a module_access row at all.
-- ----------------------------------------------------------------------------
UPDATE public.module_access SET read_slugs = ARRAY['CENTRAL'],          write_slugs = ARRAY['CENTRAL'],  write_scope = 'ALL' WHERE module = 'tenure';
UPDATE public.module_access SET read_slugs = ARRAY['CENTRAL','ZONE'],   write_slugs = ARRAY['ZONE'],     write_scope = 'ALL' WHERE module = 'zones';
UPDATE public.module_access SET read_slugs = ARRAY['CENTRAL','EXCO'],   write_slugs = ARRAY['EXCO'],     write_scope = 'OWN' WHERE module = 'workforce';
UPDATE public.module_access SET read_slugs = ARRAY['CENTRAL','LEVEL'],  write_slugs = ARRAY['LEVEL'],    write_scope = 'OWN' WHERE module = 'level';

-- ----------------------------------------------------------------------------
-- 6. rcf_profile_context — reproduce 0004 verbatim, adding `privileges` to each
--    leadership row and recomputing the admin flags from privilege tags.
--    Marked lines (-- 0006) are the only differences from 0004.
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
                'title', lp.title, 'alias', lp.alias, 'slug', lp.slug, 'category', lp.category,
                'isDefault', lp.is_default, 'unitId', l.unit_id, 'unitName', u.name,
                'classSetId', l.class_set_id, 'residentialZoneId', l.residential_zone_id,
                'tenureId', l.tenure_id,
                'privileges', COALESCE((                                        -- 0006: per-position privilege tags
                    SELECT jsonb_agg(jsonb_build_object('tag', pp.privilege, 'scope', pp.scope))
                    FROM public.position_privileges pp WHERE pp.position_id = l.position_id
                ), '[]'::jsonb)))
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
        -- 0006: admin flags are now derived from PRIVILEGE TAGS, not category/is_default.
        'isSysAdmin', EXISTS (                                                  -- 0006
            SELECT 1 FROM public.leadership l
            JOIN public.position_privileges pp ON pp.position_id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND pp.privilege = 'SYSADMIN'),
        'isPresident', EXISTS (                                                 -- 0006
            SELECT 1 FROM public.leadership l
            JOIN public.position_privileges pp ON pp.position_id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND pp.privilege = 'PRESIDENT'),
        'isVpAdmin', EXISTS (
            SELECT 1 FROM public.leadership l
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND lp.title = 'Vice President Administration'),
        -- READ-bypass tier: SysAdmin, President, or VP Admin see everything (write is
        -- gated separately in app resolvers — President is globally write-blocked).
        'isAdmin', EXISTS (                                                     -- 0006
            SELECT 1 FROM public.leadership l
            LEFT JOIN public.position_privileges pp ON pp.position_id = l.position_id
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND (pp.privilege IN ('SYSADMIN','PRESIDENT')
                   OR lp.title = 'Vice President Administration'))
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
