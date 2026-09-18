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
--   * `leadership_positions.category` and `.is_default` SURVIVE. They look like the
--     same class of legacy as is_central, but they are not: both are baked into
--     `rcf_profile_context` (0001/0004/0006), the RPC that resolves every session's
--     permissions, including the admin test `lp.is_default OR lp.category='PRESIDENT'`.
--     Dropping them means rewriting that function and ~15 call sites. That is its own
--     release with its own testing, not a footnote in a cleanup.
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
        || 'leadership.can_manage_unit, leadership_positions.is_central, '
        || 'event_registrations.raffle_id. ict-coord retiered to EXECUTIVE + EXCO:ict.')
ON CONFLICT (id) DO UPDATE
    SET version = EXCLUDED.version,
        name    = EXCLUDED.name,
        notes   = EXCLUDED.notes;

COMMIT;
