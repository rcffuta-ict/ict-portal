-- ============================================================================
-- Migration 0013 — Structural cleanup + migration tracking.   RELEASE v1.0.0
--
-- Depends on 0001–0012 (all of which the production dump confirms are applied).
--
-- WHY THIS EXISTS
--   This project is about to change hands. The single most useful thing we can leave
--   the next maintainer is a database that can ANSWER QUESTIONS ABOUT ITSELF:
--   which migrations have run, which tables are ours, and nothing lying around that
--   no code has referenced in a year. Today none of that is knowable — there is no
--   migration ledger at all, and `db/db-schema.sql` is a dump taken before 0001 with
--   later tables hand-appended, so it disagrees with reality in both directions.
--
-- WHAT THIS CHANGES
--   1. schema_migrations  — the ledger. Backfilled with 0001–0012.
--   2. position_privileges — de-duplicated, and a unique index added for SCOPED rows.
--                            (0011 claims idempotence and does not have it; see below.)
--   3. ict-coord          — retiered from SYSTEM to EXECUTIVE, and given EXCO:ict.
--   4. Dead objects       — three tables and three columns with zero references in
--                            src/ and zero in any migration, dropped.
--   5. RLS sweep          — every portal-owned table forced to service-role-only.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   * No seeding. Bootstrap data lives in db/seed/default.sql and is run separately.
--   * `leadership_positions.alias` SURVIVES and is not legacy at all — it is the short
--     DISPLAY name ("VP Admin"), a different thing from `slug` ("vp-admin"), which is
--     the immutable machine handle. An earlier draft of this plan had it wrong.
--   * Nothing belonging to another app is touched. rw_* (ReadWrite), fyb_* (Final Year
--     Brethren), elib_* (e-library) and game_*/trivia_*/bingo_*/buzzer_* share this
--     database and are not ours to clean. `public.categories` — an orphan with the
--     exact shape of rw_categories and no references anywhere — is LEFT ALONE
--     pending its owner's confirmation. Guessing is how you delete someone's data.
--
-- Idempotent and re-runnable.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. schema_migrations — the ledger.
--
-- `select * from public.schema_migrations order by id` answers "what state is this
-- database in", which before now was simply unanswerable: migrations are applied by
-- hand in the Supabase SQL editor and nothing recorded that they had been.
--
-- `version` is the RELEASE the migration shipped in, under the project's rule:
-- PATCH = code only, MINOR = a migration exists, MAJOR = not safely reversible.
-- This one drops columns, so it is 1.0.0.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id          text PRIMARY KEY,                       -- '0013'
    version     text NOT NULL,                          -- '1.0.0'
    name        text NOT NULL,                          -- 'structural_cleanup'
    -- Nullable on purpose: the backfilled rows below genuinely do not know when they
    -- were applied, and an invented timestamp is worse than an absent one.
    applied_at  timestamptz DEFAULT now(),
    applied_by  text,                                   -- whoever ran it
    notes       text
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations FORCE ROW LEVEL SECURITY;

-- If an earlier run created the ledger with a NOT NULL applied_at, relax it BEFORE the
-- backfill below tries to write NULLs into it. Harmless when it is already nullable.
ALTER TABLE public.schema_migrations ALTER COLUMN applied_at DROP NOT NULL;

-- Backfill 0001–0012. The production dump proves every one of these ran: the tables
-- and columns they create are all present. `applied_at` is unknown and honestly NULL
-- rather than invented — a fabricated timestamp is worse than a missing one.
INSERT INTO public.schema_migrations (id, version, name, applied_at, applied_by, notes)
VALUES
    ('0001', '0.1.0', 'auth_rework',                    NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0002', '0.1.0', 'invites',                        NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0003', '0.1.0', 'password_on_first_login',        NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0004', '0.1.0', 'module_access_and_slugs',        NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0005', '0.1.0', 'tenure_phase2',                  NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0006', '0.1.0', 'privilege_tags',                 NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0007', '0.1.0', 'level_tokens',                   NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0008', '0.1.0', 'testimonies',                    NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0009', '0.1.0', 'event_datetime',                 NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0010', '0.1.0', 'admin_audit_log',                NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0011', '0.1.0', 'frozen_catalogue_and_transfers', NULL, NULL, 'Backfilled by 0013 — applied date unknown.'),
    ('0012', '0.1.0', 'handover_intents',               NULL, NULL, 'Backfilled by 0013 — applied date unknown.')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. position_privileges — fix 0011's idempotency bug.
--
-- THE BUG: 0006 added a unique index on (position_id, privilege) but only WHERE
-- scope IS NULL. 0011 then seeds SCOPED rows (EXCO:<unit>, LEVEL:<token>) with
-- `ON CONFLICT DO NOTHING` — which, with no matching unique index, conflicts with
-- nothing and inserts a fresh duplicate every single time 0011 is re-run. 0011's
-- header calls itself idempotent; for its scoped privileges it is not.
--
-- Duplicates are not merely untidy here: `heldPrivileges()` in access-control.ts
-- flattens these rows, so a position with the same scope five times is evaluated five
-- times. It grants nothing extra today, but it is exactly the sort of quiet drift a
-- successor inherits and cannot explain.
-- ----------------------------------------------------------------------------
DELETE FROM public.position_privileges a
    USING public.position_privileges b
    WHERE a.scope IS NOT NULL
      AND b.scope IS NOT NULL
      AND a.position_id = b.position_id
      AND a.privilege   = b.privilege
      AND a.scope       = b.scope
      AND a.id > b.id;                       -- keep the earliest row

CREATE UNIQUE INDEX IF NOT EXISTS position_privileges_scoped_key
    ON public.position_privileges (position_id, privilege, scope)
    WHERE scope IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. The ICT Coordinator is an EXECUTIVE, and leads the ICT unit.
--
-- `tier` is hierarchy PLACEMENT and nothing else — authorization has only ever read
-- privilege tags — so moving ict-coord out of its own SYSTEM tier and in among the
-- unit heads takes nothing away from SYSADMIN. It just stops the org chart claiming
-- the ICT Coordinator stands outside the fellowship's structure.
--
-- The EXCO:ict grant is the substantive half: the ICT Coordinator leads the
-- Information and Communications Unit the way any exco leads theirs. 0006's trigger
-- permits SYSADMIN alongside EXCO (only PRESIDENT is exclusive), and because this
-- position now carries that scope, buildCatalogue() no longer mints a separate
-- `exco-ict` — otherwise the unit would have two leads with identical privileges.
-- ----------------------------------------------------------------------------
UPDATE public.leadership_positions
    SET tier        = 'EXECUTIVE',
        description = 'System Admin, and Executive of the Information and '
                      || 'Communications Unit. Full read and write everywhere, '
                      || 'including Settings and the Oracle.'
    WHERE slug = 'ict-coord';

INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'ict' FROM public.leadership_positions WHERE slug = 'ict-coord'
ON CONFLICT DO NOTHING;

-- If a standalone exco position for the ICT unit was ever minted, retire it rather
-- than delete it: someone may hold it, and deleting the position would silently strip
-- their authority. Deactivating leaves the row, the history, and a visible decision.
UPDATE public.leadership_positions SET is_active = false WHERE slug = 'exco-ict';

-- SYSTEM leaves the tier vocabulary now that nothing occupies it.
ALTER TABLE public.leadership_positions DROP CONSTRAINT IF EXISTS leadership_positions_tier_check;
ALTER TABLE public.leadership_positions
    ADD CONSTRAINT leadership_positions_tier_check
    CHECK (tier IS NULL OR tier = ANY (ARRAY['PRESIDENT','VP','EXECUTIVE','COORDINATOR']));

-- ----------------------------------------------------------------------------
-- 3b. Derive `category` instead of storing it, and rewrite rcf_profile_context.
--
-- THE PROBLEM WITH THE STORED COLUMN
--   `leadership_positions.category` ('PRESIDENT'|'CENTRAL'|'UNIT'|'TEAM'|'LEVEL'|'ZONE')
--   predates the privilege-tag model of 0006. Since then it has been a SECOND,
--   PARALLEL description of what a position is, kept in step with the first only
--   because three separate code paths remember to rewrite it on every change
--   (`deriveCategory()` in src/lib/privileges.ts). Two sources of truth for one fact is
--   the bug; the only question was ever which one to delete.
--
--   `is_default` has the same shape of problem: a hand-maintained "this position is
--   protected" flag that 0011 superseded with `is_protected`, while the auth RPC went
--   on testing the old one (`lp.is_default OR lp.category = 'PRESIDENT'`).
--
-- THE FIX
--   Derive both at read time from the privileges that already decide authorization.
--   `rcf_position_kind()` below returns exactly what `deriveCategory()` returns in
--   TypeScript, so the payload key `category` keeps its meaning and its callers — it
--   simply can no longer disagree with the tags.
--
-- ONE DELIBERATE IMPROVEMENT
--   The old RPC identified the VP Admin by `lp.title = 'Vice President Administration'`.
--   Title is an EDITABLE, display-facing string: renaming that office in the UI would
--   have silently stripped the VP Admin of `isVpAdmin` — and with it the handover, the
--   catalogue and every transfer approval. It now matches on `lp.slug = 'vp-admin'`,
--   which is immutable by design. This is a real latent bug being closed, not a
--   refactor.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rcf_position_kind(p_position_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    -- Mirrors deriveCategory() in src/lib/privileges.ts. Order matters: a position
    -- holding several tags takes the most significant one. SYSADMIN counts as CENTRAL
    -- so the ICT Coordinator still reads as a church-wide office even though it now
    -- also carries EXCO:ict for the unit it leads.
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM public.position_privileges
                      WHERE position_id = p_position_id AND privilege = 'PRESIDENT')
            THEN 'PRESIDENT'
        WHEN EXISTS (SELECT 1 FROM public.position_privileges
                      WHERE position_id = p_position_id
                        AND privilege IN ('CENTRAL','SYSADMIN'))
            THEN 'CENTRAL'
        WHEN EXISTS (SELECT 1 FROM public.position_privileges
                      WHERE position_id = p_position_id AND privilege = 'LEVEL')
            THEN 'LEVEL'
        WHEN EXISTS (SELECT 1 FROM public.position_privileges
                      WHERE position_id = p_position_id AND privilege = 'ZONE')
            THEN 'ZONE'
        -- EXCO splits on what it is scoped to: leading a team is not leading a unit.
        WHEN EXISTS (SELECT 1 FROM public.position_privileges pp
                       JOIN public.units u ON u.slug = pp.scope
                      WHERE pp.position_id = p_position_id
                        AND pp.privilege = 'EXCO' AND u.type = 'TEAM')
            THEN 'TEAM'
        ELSE 'UNIT'
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.rcf_position_kind(uuid) FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3c. rcf_profile_context — rewritten free of `category` and `is_default`.
--
-- Reproduces 0006's function exactly, with four changes, each marked `-- 0013`:
--   * roles[].scope        now public.rcf_position_kind(lp.id)   (was lp.category)
--   * roles[].slug         added — an immutable handle the client can test against
--                          instead of comparing editable titles
--   * leadership[].category now derived; .isDefault replaced by .tier + .isProtected
--   * isVpAdmin / isAdmin  now match lp.slug = 'vp-admin' (was the editable title)
--
-- Must run BEFORE the column drops below.
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
                'title', lp.title, 'slug', lp.slug,
                'scope', public.rcf_position_kind(lp.id),
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
                'title', lp.title, 'alias', lp.alias, 'slug', lp.slug,
                'category', public.rcf_position_kind(lp.id),          -- 0013: derived, not stored
                'tier', lp.tier, 'isProtected', lp.is_protected,      -- 0013: replaces isDefault
                'unitId', l.unit_id, 'unitName', u.name,
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
        -- 0006: admin flags are derived from PRIVILEGE TAGS, not category/is_default.
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
              AND lp.slug = 'vp-admin'),                                 -- 0013: slug, not title
        -- READ-bypass tier: SysAdmin, President, or VP Admin see everything (write is
        -- gated separately in app resolvers — President is globally write-blocked).
        'isAdmin', EXISTS (                                                     -- 0006
            SELECT 1 FROM public.leadership l
            LEFT JOIN public.position_privileges pp ON pp.position_id = l.position_id
            JOIN public.leadership_positions lp ON lp.id = l.position_id
            WHERE l.profile_id = p.id AND (v_tenure_id IS NULL OR l.tenure_id = v_tenure_id)
              AND (pp.privilege IN ('SYSADMIN','PRESIDENT')
                   OR lp.slug = 'vp-admin'))                             -- 0013: slug, not title
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
-- 4. Drop what nothing references.
--
-- Each of these was verified against the whole of src/ and the whole of db/migrations/
-- before being listed. This is the irreversible part of the migration, and the reason
-- the release is a MAJOR: take the full system backup first.
-- ----------------------------------------------------------------------------

-- `verification_codes` — email verification. The portal sends no mail; the feature was
-- removed by decision, and this table has been dead since.
DROP TABLE IF EXISTS public.verification_codes;

-- `question_flags` / `question_references` — built alongside the Q&A feature, never
-- wired to any UI. `question_stars` IS used and stays.
DROP TABLE IF EXISTS public.question_flags;
DROP TABLE IF EXISTS public.question_references;

-- `leadership.can_manage_unit` — the pre-0006 permission flag, wholly superseded by
-- the EXCO privilege tag. Zero readers.
ALTER TABLE public.leadership DROP COLUMN IF EXISTS can_manage_unit;

-- `leadership_positions.is_central` — superseded by the CENTRAL privilege tag. It was
-- written in three places and read in none.
ALTER TABLE public.leadership_positions DROP COLUMN IF EXISTS is_central;

-- `event_registrations.raffle_id` — a one-off for a single past event.
ALTER TABLE public.event_registrations DROP COLUMN IF EXISTS raffle_id;

-- `leadership_positions.category` — a second, parallel description of what a position
-- is, now derived from the privilege tags by rcf_position_kind(). See 3b.
ALTER TABLE public.leadership_positions DROP COLUMN IF EXISTS category;

-- `leadership_positions.is_default` — superseded by `is_protected` (0011). The auth
-- RPC no longer reads it; the app identifies the fixed offices by immutable SLUG
-- (FIXED_POSITIONS in src/config/leadership-positions.ts), which is what it should
-- always have done.
ALTER TABLE public.leadership_positions DROP COLUMN IF EXISTS is_default;

-- ----------------------------------------------------------------------------
-- 5. RLS sweep over portal-owned tables.
--
-- Every portal table is meant to be service-role-only: RLS ENABLED and FORCED with no
-- policies, so the anon/publishable key can read nothing (0001's posture). But tables
-- added outside the migration series never went through that pass — `zone_pastors`
-- is in production and in no migration at all — and a portal table readable with the
-- anon key is a straightforward data leak.
--
-- This FIXES rather than fails, because a migration that refuses to run leaves the
-- leak in place, which is the worse outcome. Every table it had to correct is named
-- in a NOTICE so the fix is visible in the SQL editor output rather than silent.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    t          text;
    v_fixed    text[] := ARRAY[]::text[];
    v_relrowsecurity boolean;
    v_relforcerowsecurity boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'class_sets','residential_zones','profiles','tenures','units','leadership',
        'leadership_positions','position_privileges','membership_units','unit_positions',
        'zone_pastors','module_access','profile_login','auth_sessions','login_events',
        'registration_invites','invite_events','events','event_registrations',
        'event_questions','question_stars','testimonies','testimony_amens',
        'lo_member_links','lo_member_verify_attempts','admin_audit_log',
        'unit_transfer_requests','handover_intents','handover_events','schema_migrations'
    ]
    LOOP
        SELECT c.relrowsecurity, c.relforcerowsecurity
          INTO v_relrowsecurity, v_relforcerowsecurity
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = t;

        IF NOT FOUND THEN
            RAISE NOTICE 'RLS sweep: table public.% does not exist — skipped.', t;
            CONTINUE;
        END IF;

        IF NOT v_relrowsecurity OR NOT v_relforcerowsecurity THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
            v_fixed := v_fixed || t;
        END IF;
    END LOOP;

    IF array_length(v_fixed, 1) > 0 THEN
        RAISE NOTICE '*** RLS sweep CORRECTED % table(s), which were reachable with the anon key: % ***',
            array_length(v_fixed, 1), array_to_string(v_fixed, ', ');
    ELSE
        RAISE NOTICE 'RLS sweep: all portal tables already locked down.';
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 6. Record this migration.
-- ----------------------------------------------------------------------------
INSERT INTO public.schema_migrations (id, version, name, applied_at, applied_by, notes)
VALUES ('0013', '1.0.0', 'structural_cleanup', now(), current_user,
        'Dropped verification_codes, question_flags, question_references, '
        || 'leadership.can_manage_unit, event_registrations.raffle_id, and '
        || 'leadership_positions.is_central/category/is_default. category is now derived '
        || 'by rcf_position_kind(); rcf_profile_context rewritten and VP Admin matched '
        || 'by slug rather than editable title. ict-coord retiered to EXECUTIVE + EXCO:ict.')
ON CONFLICT (id) DO UPDATE
    SET version = EXCLUDED.version,
        name    = EXCLUDED.name,
        notes   = EXCLUDED.notes;

COMMIT;
