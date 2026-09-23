-- ============================================================================
-- DEFAULT SEED — the fellowship's bootstrap structure.          RELEASE v1.0.0
--
-- GENERATED FILE — do not edit by hand.
--   Source:    src/config/fellowship-units.ts
--              src/config/leadership-positions.ts
--   Regenerate: node scripts/gen-default-seed.mjs
--
-- THIS RUNS IN PRODUCTION. It is bootstrap data, not test data: the offices and
-- units that exist in every tenure regardless of who fills them.
--
-- IT SEEDS NO PEOPLE. No profiles, no tenures, no leadership rows. Who holds an
-- office is never seed data — it is the outcome of an appointment, and inventing
-- one would put a person in the cabinet that nobody appointed.
--
-- RE-RUNNABLE, and that is its second job: running it again is the RESET SEED,
-- returning the catalogue to canonical state after someone has edited a title or
-- deactivated an office by mistake. It restores names and privileges; it never
-- deletes a position (somebody may hold it) and never touches a person.
--
-- SLUGS ARE IMMUTABLE. A slug IS an access-control scope: `EXCO:choir` is the
-- privilege, `exco-choir` the position, `choir` the unit. Titles and aliases are
-- free to change; changing a slug moves permissions and is never done here.
--
-- Depends on supabase/migrations being applied first — in particular the
-- grants_login column from 20260920162209_tighten_office_catalogue.sql.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Units and teams (25: 18 units, 7 team).
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
    ('secretariat', 'Secretariat', 'TEAM', 'Keeps the fellowship''s office, its records and its correspondence.', true),
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
    ('exco-secretariat', 'Executive — Secretariat', 'Secretariat Keeper',
     'Leads Secretariat. Adds and removes its members directly.',
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
SELECT id, 'EXCO', 'secretariat' FROM public.leadership_positions WHERE slug = 'exco-secretariat'
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
INSERT INTO public.module_access (module, read_slugs, write_slugs, write_scope)
VALUES
    ('tenure',    ARRAY['CENTRAL'],          ARRAY['CENTRAL'], 'ALL'),
    ('zones',     ARRAY['CENTRAL','ZONE'],   ARRAY['ZONE'],    'OWN'),
    ('workforce', ARRAY['CENTRAL','EXCO'],   ARRAY['EXCO'],    'OWN'),
    ('level',     ARRAY['CENTRAL','LEVEL'],  ARRAY['LEVEL'],   'OWN')
ON CONFLICT (module) DO NOTHING;

COMMIT;
