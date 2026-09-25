-- ============================================================================
-- Reset the fellowship's structure to the catalogue.
--
-- WHY
--   Production still carried offices, units and access tags from before the frozen
--   catalogue: a generic "Level Coordinator", a "Prayer Secretary", a typo'd
--   "evel coordinator", units under old slugs (follow-up-counseling,
--   hall-representatives), and church-wide read access on the General and Financial
--   Secretaries. The default seed only ever ADDS, so re-running it could never clear
--   those. This makes the structure exactly what db/seed/default.sql describes.
--
-- WHAT IT DOES
--   1. Applies the catalogue as the seed states it (copied below from
--      db/seed/default.sql, generated from src/config/). Upserts; module access is
--      only inserted where absent, so the System Admin's settings stand.
--   2. Removes every access tag the catalogue doesn't give its office.
--   3. Retires every office that isn't in the catalogue. An office that no longer
--      exists can't be held, so its CURRENT appointments END (the rows stay, as
--      service history). Holders left with no other office that grants a login lose
--      their login and sessions, exactly as removing them in the app does. The office
--      is then deleted if nothing refers to it, or kept inactive as a record.
--   4. Deletes every unit or team that isn't in the catalogue and that nothing refers
--      to. One that still has members, appointments or transfers is kept, with a
--      NOTICE, because deleting it would take those with it.
--
-- WHAT IT DOES NOT DO
--   It never deletes a person, a membership or an appointment row. Access settings
--   and each office's login switch are left alone, except on offices it retires.
--   On a database that already matches the catalogue (staging), it changes nothing.
--
-- Generated from db/seed/default.sql (24 units and teams, 36 offices,
-- 34 access tags). Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The catalogue, as db/seed/default.sql states it
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1. Units and teams (24: 18 units, 6 team).
--
-- A member belongs to exactly ONE unit (the enforce_single_unit_membership
-- trigger from 0001) but to any number of teams. That is the whole distinction:
-- a team is something you take on in ADDITION to your unit.
--
-- Matched on slug, so re-running restores an edited name without minting a
-- duplicate unit.
-- ----------------------------------------------------------------------------
-- is_workforce is FALSE for the Brothers' and Sisters' units. They are gender
-- categories rather than units anybody joins -- every member is in one of them
-- already -- so counting them as workforce would make every member a worker and
-- the "who is serving?" figure meaningless.
INSERT INTO public.units (slug, name, type, description, is_workforce)
VALUES
    ('follow-up-and-counselling', 'Follow-up & Counselling Unit', 'UNIT', 'Follows up new and returning members, and coordinates pastoral counselling.', true),
    ('media-and-ambience', 'Media and Ambience Unit', 'UNIT', 'Sound, projection, photography, and the look and feel of every service.', true),
    ('sanctuary-keeping', 'Sanctuary Keeping Unit', 'UNIT', 'Keeps the sanctuary and its surroundings clean and ready.', true),
    ('library', 'Library', 'UNIT', 'Custodian of the fellowship''s books and study materials.', true),
    ('alumni-relations', 'Alumni Relations', 'UNIT', 'Keeps the fellowship in touch with those who have graduated.', true),
    ('editorial', 'Editorial Unit', 'UNIT', 'Writes, edits and publishes the fellowship''s publications.', true),
    ('academic', 'Academic Unit', 'UNIT', 'Tutorials, study groups and academic support across departments.', true),
    ('academic-counselling', 'Academic Counselling Team', 'TEAM', 'Advises members on course choices and academic difficulty. A TEAM, so members may serve here alongside their own unit.', true),
    ('ushering', 'Ushering Unit', 'UNIT', 'Welcomes, seats and orders the congregation during services.', true),
    ('choir', 'Choir Unit', 'UNIT', 'Leads the fellowship in worship and ministration.', true),
    ('prayer', 'Prayer Unit', 'UNIT', 'Carries the fellowship''s prayer life and intercession.', true),
    ('hall-reps', 'Hall Reps Unit', 'UNIT', 'Represents the fellowship in each hall of residence.', true),
    ('drama', 'Drama Unit', 'UNIT', 'Ministers through drama and stage presentation.', true),
    ('welfare', 'Welfare Unit', 'UNIT', 'Sees to the practical needs and wellbeing of members.', true),
    ('sport', 'Sports Team', 'TEAM', 'Organises the fellowship''s sporting life and fixtures.', true),
    ('sisters', 'Sisters'' Unit', 'UNIT', 'Every sister in the fellowship. Membership follows gender, not induction.', false),
    ('bible-study', 'Bible Study Unit', 'UNIT', 'Plans and leads the fellowship''s study of the scriptures.', true),
    ('organizing', 'Organizing Unit', 'UNIT', 'Sets up, arranges and runs the logistics of every gathering.', true),
    ('evangelism', 'Evangelism Unit', 'UNIT', 'Leads outreach and soul-winning on and off campus.', true),
    ('brothers', 'Brothers'' Unit', 'UNIT', 'Every brother in the fellowship. Membership follows gender, not induction.', false),
    ('commerce', 'Commerce Team', 'TEAM', 'Runs the fellowship''s trade, sales and commercial ventures.', true),
    ('protocol', 'Protocol Team', 'TEAM', 'Receives and attends to guests, ministers and dignitaries.', true),
    ('transport', 'Transport Team', 'TEAM', 'Arranges movement for fellowship programmes and outreaches.', true),
    ('ict', 'Information and Communications Team', 'TEAM', 'Runs the infrastructure, and manages the fellowship''s systems and its communications.', true)
ON CONFLICT (slug) DO UPDATE
    SET name         = EXCLUDED.name,
        type         = EXCLUDED.type,
        description  = EXCLUDED.description,
        is_workforce = EXCLUDED.is_workforce;

-- ----------------------------------------------------------------------------
-- 2. The frozen position catalogue (36 offices).
--
-- `category` is NOT set: migration 0013 dropped the column and the kind is now
-- derived from the privilege tags below by rcf_position_kind().
--
-- is_protected = true marks these as catalogue rows, which the
-- enforce_frozen_position_catalogue trigger (0011) refuses to DELETE.
--
-- grants_login says whether appointment to the office comes with a PORTAL
-- LOGIN. Most of the fellowship's offices are here as a record of service and
-- administer nothing in the portal, so they grant none. It is set on INSERT
-- only: once the row exists the column belongs to the VP Admin, and re-running
-- this seed must not overrule an access decision they made deliberately.
-- ----------------------------------------------------------------------------
INSERT INTO public.leadership_positions
    (slug, title, alias, description, tier, is_active, is_protected, grants_login)
VALUES
    ('president', 'President', 'President',
     'Head of the fellowship. Sees every module including Settings, and is globally write-blocked.',
     'PRESIDENT', true, true, true),
    ('vp-admin', 'Vice President Administration', 'VP Admin',
     'Administrative head. Appoints leaders, approves unit transfers, and runs the handover.',
     'VP', true, true, true),
    ('vp-church-growth', 'Vice President Church Growth', 'VP Church Growth',
     'Growth and outreach head. Church-wide read access.',
     'VP', true, true, true),
    ('gen-sec', 'General Secretary', 'Gen Sec',
     'Keeps the fellowship''s minutes, records and correspondence. Honorary in the portal — no access unless the VP Admin grants it.',
     'EXECUTIVE', true, true, false),
    ('fin-sec', 'Financial Secretary', 'Fin Sec',
     'Keeps the fellowship''s accounts. Honorary in the portal — the finances are not held here, so no access unless the VP Admin grants it.',
     'EXECUTIVE', true, true, false),
    ('exco-secretariat', 'Secretariat Keeper', 'Secretariat Keeper',
     'An executive seat honouring the Secretariat Keeper. Honorary in the portal — no access unless the VP Admin grants it.',
     'EXECUTIVE', true, true, false),
    ('ict-coord', 'ICT Coordinator', 'ICT Coord',
     'System Admin, and Executive of the Information and Communications Unit. Full read and write everywhere, including Settings and the Oracle.',
     'EXECUTIVE', true, true, true),
    ('exco-follow-up-and-counselling', 'Executive — Follow-up & Counselling Unit', 'Follow-up Coord',
     'Leads Follow-up & Counselling Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-media-and-ambience', 'Executive — Media and Ambience Unit', 'Media Coord',
     'Leads Media and Ambience Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-sanctuary-keeping', 'Executive — Sanctuary Keeping Unit', 'Sanctuary Coord',
     'Leads Sanctuary Keeping Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-library', 'Executive — Library', 'Librarian',
     'Leads Library. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-alumni-relations', 'Executive — Alumni Relations', 'Alumni Relations Officer',
     'Leads Alumni Relations. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-editorial', 'Executive — Editorial Unit', 'Editor',
     'Leads Editorial Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-academic', 'Executive — Academic Unit', 'Academic Coord',
     'Leads Academic Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-academic-counselling', 'Executive — Academic Counselling Team', 'Academic Counsellor',
     'Leads Academic Counselling Team. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-ushering', 'Executive — Ushering Unit', 'Chief Usher',
     'Leads Ushering Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-choir', 'Executive — Choir Unit', 'Choir Coord',
     'Leads Choir Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-prayer', 'Executive — Prayer Unit', 'Prayer Secretary',
     'Leads Prayer Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-hall-reps', 'Executive — Hall Reps Unit', 'Hall Reps Coord',
     'Leads Hall Reps Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-drama', 'Executive — Drama Unit', 'Drama Coord',
     'Leads Drama Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-welfare', 'Executive — Welfare Unit', 'Welfare Coord',
     'Leads Welfare Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-sport', 'Executive — Sports Team', 'Director of Sports',
     'Leads Sports Team. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-sisters', 'Executive — Sisters'' Unit', 'Sisters'' Coord',
     'Leads Sisters'' Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-bible-study', 'Executive — Bible Study Unit', 'Bible Study Secretary',
     'Leads Bible Study Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-organizing', 'Executive — Organizing Unit', 'Organizing Secretary',
     'Leads Organizing Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-evangelism', 'Executive — Evangelism Unit', 'Evangelism Coord',
     'Leads Evangelism Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-brothers', 'Executive — Brothers'' Unit', 'Brothers'' Coord',
     'Leads Brothers'' Unit. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-commerce', 'Executive — Commerce Team', 'Director of Commerce',
     'Leads Commerce Team. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-protocol', 'Executive — Protocol Team', 'Protocol Officer',
     'Leads Protocol Team. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('exco-transport', 'Executive — Transport Team', 'Transport Secretary',
     'Leads Transport Team. Adds and removes its members directly.',
     'EXECUTIVE', true, true, true),
    ('level-coord-pds-uabs', 'Level Coordinator — PDS/UABS', 'PDS/UABS Coord',
     'Coordinates PDS/UABS. Authority is limited to that generation.',
     'COORDINATOR', true, true, true),
    ('level-coord-100', 'Level Coordinator — 100 Level', '100 Level Coord',
     'Coordinates 100 Level. Authority is limited to that generation.',
     'COORDINATOR', true, true, true),
    ('level-coord-200', 'Level Coordinator — 200 Level', '200 Level Coord',
     'Coordinates 200 Level. Authority is limited to that generation.',
     'COORDINATOR', true, true, true),
    ('level-coord-300', 'Level Coordinator — 300 Level', '300 Level Coord',
     'Coordinates 300 Level. Authority is limited to that generation.',
     'COORDINATOR', true, true, true),
    ('level-coord-400', 'Level Coordinator — 400 Level', '400 Level Coord',
     'Coordinates 400 Level. Authority is limited to that generation.',
     'COORDINATOR', true, true, true),
    ('level-coord-all', 'Level Coordinator — 500 Level', '500 Level Coord',
     'Coordinates the finalists, and holds coordinator authority over EVERY level in the fellowship.',
     'COORDINATOR', true, true, true)
ON CONFLICT (slug) DO UPDATE
    SET title        = EXCLUDED.title,
        alias        = EXCLUDED.alias,
        description  = EXCLUDED.description,
        tier         = EXCLUDED.tier,
        is_active    = true,
        is_protected = true;

-- ----------------------------------------------------------------------------
-- 3. Privilege tags — the ONLY thing that decides authorization.
--
-- Note `level-coord-all`: the 500-Level coordinator is scoped 'all', not '500'.
-- Finalist coordinators hold authority over EVERY level in the fellowship, and
-- that rule lives here as DATA rather than as a branch in the resolver, because
-- canManageLevel() already treats an 'all' scope as every generation.
--
-- Note `ict-coord`: two tags. SYSADMIN is the portal-wide System Admin right;
-- EXCO:ict is leading the ICT unit like any other exco.
-- ----------------------------------------------------------------------------
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'PRESIDENT', NULL FROM public.leadership_positions WHERE slug = 'president'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'CENTRAL', NULL FROM public.leadership_positions WHERE slug = 'vp-admin'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'CENTRAL', NULL FROM public.leadership_positions WHERE slug = 'vp-church-growth'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'SYSADMIN', NULL FROM public.leadership_positions WHERE slug = 'ict-coord'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'ict' FROM public.leadership_positions WHERE slug = 'ict-coord'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'follow-up-and-counselling' FROM public.leadership_positions WHERE slug = 'exco-follow-up-and-counselling'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'media-and-ambience' FROM public.leadership_positions WHERE slug = 'exco-media-and-ambience'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'sanctuary-keeping' FROM public.leadership_positions WHERE slug = 'exco-sanctuary-keeping'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'library' FROM public.leadership_positions WHERE slug = 'exco-library'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'alumni-relations' FROM public.leadership_positions WHERE slug = 'exco-alumni-relations'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'editorial' FROM public.leadership_positions WHERE slug = 'exco-editorial'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'academic' FROM public.leadership_positions WHERE slug = 'exco-academic'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'academic-counselling' FROM public.leadership_positions WHERE slug = 'exco-academic-counselling'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'ushering' FROM public.leadership_positions WHERE slug = 'exco-ushering'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'choir' FROM public.leadership_positions WHERE slug = 'exco-choir'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'prayer' FROM public.leadership_positions WHERE slug = 'exco-prayer'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'hall-reps' FROM public.leadership_positions WHERE slug = 'exco-hall-reps'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'drama' FROM public.leadership_positions WHERE slug = 'exco-drama'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'welfare' FROM public.leadership_positions WHERE slug = 'exco-welfare'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'sport' FROM public.leadership_positions WHERE slug = 'exco-sport'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'sisters' FROM public.leadership_positions WHERE slug = 'exco-sisters'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'bible-study' FROM public.leadership_positions WHERE slug = 'exco-bible-study'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'organizing' FROM public.leadership_positions WHERE slug = 'exco-organizing'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'evangelism' FROM public.leadership_positions WHERE slug = 'exco-evangelism'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'brothers' FROM public.leadership_positions WHERE slug = 'exco-brothers'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'commerce' FROM public.leadership_positions WHERE slug = 'exco-commerce'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'protocol' FROM public.leadership_positions WHERE slug = 'exco-protocol'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'EXCO', 'transport' FROM public.leadership_positions WHERE slug = 'exco-transport'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'LEVEL', 'pds-uabs' FROM public.leadership_positions WHERE slug = 'level-coord-pds-uabs'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'LEVEL', '100' FROM public.leadership_positions WHERE slug = 'level-coord-100'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'LEVEL', '200' FROM public.leadership_positions WHERE slug = 'level-coord-200'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'LEVEL', '300' FROM public.leadership_positions WHERE slug = 'level-coord-300'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'LEVEL', '400' FROM public.leadership_positions WHERE slug = 'level-coord-400'
ON CONFLICT DO NOTHING;
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'LEVEL', 'all' FROM public.leadership_positions WHERE slug = 'level-coord-all'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Module access defaults.
--
-- Inserted ONLY where absent: this is the System Admin's runtime configuration,
-- and a reset seed that overwrote a deliberate access decision would be a
-- security regression dressed up as housekeeping.
-- ----------------------------------------------------------------------------
--
-- The tenure row is IGNORED by the app: its access is fixed by policy in
-- src/lib/modules.ts (POLICY_FIXED_MODULES) -- President, VPs and System Admin
-- read; only the System Admin and VP Admin write. Kept so the table has a row
-- for every module, with values that match what the code enforces.
--
-- academics: the Academic Coord (EXCO:academic) reads and writes it by default.
-- Faculties and departments are NOT seeded here: they are data the Academic Unit
-- maintains, seeded once by the academics_module migration.
INSERT INTO public.module_access (module, read_slugs, write_slugs, write_scope)
VALUES
    ('tenure',    ARRAY['CENTRAL'],          ARRAY[]::text[],  'ALL'),
    ('zones',     ARRAY['CENTRAL','ZONE'],   ARRAY['ZONE'],    'OWN'),
    ('workforce', ARRAY['CENTRAL','EXCO'],   ARRAY['EXCO'],    'OWN'),
    ('level',     ARRAY['CENTRAL','LEVEL'],  ARRAY['LEVEL'],   'OWN'),
    ('academics', ARRAY['EXCO:academic'],    ARRAY['EXCO:academic'], 'ALL')
ON CONFLICT (module) DO NOTHING;

-- ----------------------------------------------------------------------------
-- What the catalogue contains, for the clean-up below
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE catalogue_units (slug text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO catalogue_units (slug) VALUES
    ('follow-up-and-counselling'),
    ('media-and-ambience'),
    ('sanctuary-keeping'),
    ('library'),
    ('alumni-relations'),
    ('editorial'),
    ('academic'),
    ('academic-counselling'),
    ('ushering'),
    ('choir'),
    ('prayer'),
    ('hall-reps'),
    ('drama'),
    ('welfare'),
    ('sport'),
    ('sisters'),
    ('bible-study'),
    ('organizing'),
    ('evangelism'),
    ('brothers'),
    ('commerce'),
    ('protocol'),
    ('transport'),
    ('ict');

CREATE TEMP TABLE catalogue_positions (slug text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO catalogue_positions (slug) VALUES
    ('president'),
    ('vp-admin'),
    ('vp-church-growth'),
    ('gen-sec'),
    ('fin-sec'),
    ('exco-secretariat'),
    ('ict-coord'),
    ('exco-follow-up-and-counselling'),
    ('exco-media-and-ambience'),
    ('exco-sanctuary-keeping'),
    ('exco-library'),
    ('exco-alumni-relations'),
    ('exco-editorial'),
    ('exco-academic'),
    ('exco-academic-counselling'),
    ('exco-ushering'),
    ('exco-choir'),
    ('exco-prayer'),
    ('exco-hall-reps'),
    ('exco-drama'),
    ('exco-welfare'),
    ('exco-sport'),
    ('exco-sisters'),
    ('exco-bible-study'),
    ('exco-organizing'),
    ('exco-evangelism'),
    ('exco-brothers'),
    ('exco-commerce'),
    ('exco-protocol'),
    ('exco-transport'),
    ('level-coord-pds-uabs'),
    ('level-coord-100'),
    ('level-coord-200'),
    ('level-coord-300'),
    ('level-coord-400'),
    ('level-coord-all');

CREATE TEMP TABLE catalogue_privileges (slug text, privilege text, scope text) ON COMMIT DROP;
INSERT INTO catalogue_privileges (slug, privilege, scope) VALUES
    ('president', 'PRESIDENT', NULL),
    ('vp-admin', 'CENTRAL', NULL),
    ('vp-church-growth', 'CENTRAL', NULL),
    ('ict-coord', 'SYSADMIN', NULL),
    ('ict-coord', 'EXCO', 'ict'),
    ('exco-follow-up-and-counselling', 'EXCO', 'follow-up-and-counselling'),
    ('exco-media-and-ambience', 'EXCO', 'media-and-ambience'),
    ('exco-sanctuary-keeping', 'EXCO', 'sanctuary-keeping'),
    ('exco-library', 'EXCO', 'library'),
    ('exco-alumni-relations', 'EXCO', 'alumni-relations'),
    ('exco-editorial', 'EXCO', 'editorial'),
    ('exco-academic', 'EXCO', 'academic'),
    ('exco-academic-counselling', 'EXCO', 'academic-counselling'),
    ('exco-ushering', 'EXCO', 'ushering'),
    ('exco-choir', 'EXCO', 'choir'),
    ('exco-prayer', 'EXCO', 'prayer'),
    ('exco-hall-reps', 'EXCO', 'hall-reps'),
    ('exco-drama', 'EXCO', 'drama'),
    ('exco-welfare', 'EXCO', 'welfare'),
    ('exco-sport', 'EXCO', 'sport'),
    ('exco-sisters', 'EXCO', 'sisters'),
    ('exco-bible-study', 'EXCO', 'bible-study'),
    ('exco-organizing', 'EXCO', 'organizing'),
    ('exco-evangelism', 'EXCO', 'evangelism'),
    ('exco-brothers', 'EXCO', 'brothers'),
    ('exco-commerce', 'EXCO', 'commerce'),
    ('exco-protocol', 'EXCO', 'protocol'),
    ('exco-transport', 'EXCO', 'transport'),
    ('level-coord-pds-uabs', 'LEVEL', 'pds-uabs'),
    ('level-coord-100', 'LEVEL', '100'),
    ('level-coord-200', 'LEVEL', '200'),
    ('level-coord-300', 'LEVEL', '300'),
    ('level-coord-400', 'LEVEL', '400'),
    ('level-coord-all', 'LEVEL', 'all');

-- ----------------------------------------------------------------------------
-- 2. Access tags the catalogue doesn't give
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_count int;
BEGIN
    DELETE FROM public.position_privileges pp
     USING public.leadership_positions lp
     WHERE pp.position_id = lp.id
       AND NOT EXISTS (
           SELECT 1 FROM catalogue_privileges c
            WHERE c.slug = lp.slug
              AND c.privilege = pp.privilege
              AND c.scope IS NOT DISTINCT FROM pp.scope);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
        RAISE NOTICE 'Removed % access tag(s) the catalogue does not give.', v_count;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Offices that aren't in the catalogue
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE retiring_holders ON COMMIT DROP AS
    SELECT DISTINCT l.profile_id, l.tenure_id
      FROM public.leadership l
      JOIN public.leadership_positions lp ON lp.id = l.position_id
     WHERE lp.slug NOT IN (SELECT slug FROM catalogue_positions)
       AND l.ended_at IS NULL;

DO $$
DECLARE
    v_tenure_id uuid;
    v_ended     int := 0;
    v_logins    int := 0;
    v_sessions  int := 0;
    v_deleted   int := 0;
    v_kept      int := 0;
    v_count     int;
    r           record;
BEGIN
    SELECT id INTO v_tenure_id FROM public.tenures WHERE is_active LIMIT 1;

    UPDATE public.leadership l
       SET ended_at = now()
      FROM public.leadership_positions lp
     WHERE lp.id = l.position_id
       AND lp.slug NOT IN (SELECT slug FROM catalogue_positions)
       AND l.ended_at IS NULL;
    GET DIAGNOSTICS v_ended = ROW_COUNT;

    -- Logins: mirrors deprovisionLoginIfUnappointed() in src/lib/auth/provision.ts.
    -- Only in the active tenure, and only for holders with no other current office
    -- that grants a login. With no active tenure, access is left alone, as the app does.
    IF v_tenure_id IS NOT NULL THEN
        FOR r IN
            SELECT h.profile_id
              FROM retiring_holders h
             WHERE h.tenure_id = v_tenure_id
               AND NOT EXISTS (
                   SELECT 1
                     FROM public.leadership o
                     JOIN public.leadership_positions op ON op.id = o.position_id
                    WHERE o.profile_id = h.profile_id
                      AND o.tenure_id = v_tenure_id
                      AND o.ended_at IS NULL
                      AND op.grants_login)
        LOOP
            -- revoked_at, not DELETE: the audit trigger records each revocation.
            UPDATE public.auth_sessions
               SET revoked_at = now(), revoked_reason = 'leadership_removed'
             WHERE profile_id = r.profile_id AND revoked_at IS NULL;
            GET DIAGNOSTICS v_count = ROW_COUNT;
            v_sessions := v_sessions + v_count;

            DELETE FROM public.profile_login WHERE profile_id = r.profile_id;
            GET DIAGNOSTICS v_count = ROW_COUNT;
            v_logins := v_logins + v_count;
        END LOOP;
    END IF;

    FOR r IN
        SELECT id, slug, title FROM public.leadership_positions
         WHERE slug NOT IN (SELECT slug FROM catalogue_positions)
    LOOP
        -- Out of the catalogue, so no longer protected from deletion (0011's trigger).
        UPDATE public.leadership_positions
           SET is_active = false, is_protected = false, grants_login = false
         WHERE id = r.id;

        IF EXISTS (SELECT 1 FROM public.leadership WHERE position_id = r.id) THEN
            -- Someone held it: keep it, inactive and without access, as their record.
            v_kept := v_kept + 1;
            RAISE NOTICE 'Kept "%" (%) inactive: it is on someone''s service record.', r.title, r.slug;
        ELSE
            DELETE FROM public.leadership_positions WHERE id = r.id;
            v_deleted := v_deleted + 1;
        END IF;
    END LOOP;

    IF v_ended + v_deleted + v_kept > 0 THEN
        RAISE NOTICE 'Offices outside the catalogue: % deleted, % kept as records. % appointment(s) ended; % login(s) removed and % session(s) revoked.',
            v_deleted, v_kept, v_ended, v_logins, v_sessions;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Units and teams that aren't in the catalogue
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT id, slug, name FROM public.units
         WHERE slug NOT IN (SELECT slug FROM catalogue_units)
    LOOP
        IF EXISTS (SELECT 1 FROM public.membership_units      WHERE unit_id = r.id)
        OR EXISTS (SELECT 1 FROM public.membership_events     WHERE unit_id = r.id)
        OR EXISTS (SELECT 1 FROM public.leadership            WHERE unit_id = r.id)
        OR EXISTS (SELECT 1 FROM public.unit_positions        WHERE unit_id = r.id)
        OR EXISTS (SELECT 1 FROM public.unit_transfer_requests
                    WHERE from_unit_id = r.id OR to_unit_id = r.id)
        THEN
            RAISE NOTICE 'Kept "%" (%): it still has members, appointments or transfers. Move them, then delete it.', r.name, r.slug;
        ELSE
            DELETE FROM public.units WHERE id = r.id;
            RAISE NOTICE 'Removed "%" (%): not in the catalogue.', r.name, r.slug;
        END IF;
    END LOOP;
END $$;

COMMIT;
