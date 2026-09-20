-- ============================================================================
-- TIGHTEN THE OFFICE CATALOGUE
--
-- Three things, all of them about the gap between "holds an office" and "can use
-- the portal".
--
--   1. Every office in the fellowship's own list now exists in the system, so a
--      member's service is on record under their name. That list had offices the
--      portal had never heard of (General Secretary, Financial Secretary, Commerce,
--      Secretariat, Protocol, Transport, the Brothers' Unit), and it classified
--      Sports as a TEAM where the portal had it as a UNIT.
--
--   2. Existing in the catalogue no longer implies a login. Appointment used to
--      provision `profile_login` unconditionally, so adding the Transport Secretary
--      to the catalogue would have minted an account for someone with nothing to
--      administer. `grants_login` decides that per office, and the VP Admin owns it.
--
--   3. One lead per office per tenure is enforced by the DATABASE, not just by a
--      SELECT-then-INSERT in the app. Assistants stay unlimited — that is what
--      `is_lead = false` has meant since migration 0005.
--
-- Idempotent and re-runnable, like 0009-0013.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. grants_login — does appointment to this office come with portal access?
--
-- Defaults to FALSE so that a position created without anyone thinking about access
-- grants none. The backfill immediately below is what preserves today's behaviour
-- for every office that already exists.
-- ----------------------------------------------------------------------------
ALTER TABLE public.leadership_positions
    ADD COLUMN IF NOT EXISTS grants_login boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leadership_positions.grants_login IS
    'Whether appointment to this office provisions a profile_login row. Owned by the VP Admin (setPositionLoginAction). Holding an office is a record of service; this is access.';

-- Backfill: a position holding at least one privilege tag has something to manage,
-- so it keeps the access it has today. A position with no tags is honorary.
--
-- Guarded on a sentinel so re-running the migration does not silently re-grant
-- access to an office the VP Admin has since switched off. Without this, the second
-- run would undo a deliberate revocation.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.leadership_positions WHERE grants_login
    ) THEN
        UPDATE public.leadership_positions p
           SET grants_login = true
         WHERE EXISTS (
             SELECT 1 FROM public.position_privileges pp WHERE pp.position_id = p.id
         );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Two offices may never lose their login.
--
-- A VP Admin who switches off their own office's access locks the fellowship out of
-- the only screen that could switch it back on, and an ICT Coordinator without a
-- login is a System Admin who cannot reach the system. The app refuses this too
-- (isUndisableableLogin); this is the half that survives a direct SQL edit.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_login_granting_offices()
RETURNS trigger AS $$
BEGIN
    IF NEW.slug IN ('vp-admin', 'ict-coord') AND NOT NEW.grants_login THEN
        RAISE EXCEPTION
            'Office "%" must always grant portal access — revoking it would leave the fellowship unable to administer itself.',
            NEW.title;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_login_granting_offices ON public.leadership_positions;
CREATE TRIGGER trg_login_granting_offices
    BEFORE INSERT OR UPDATE ON public.leadership_positions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_login_granting_offices();

UPDATE public.leadership_positions
   SET grants_login = true
 WHERE slug IN ('vp-admin', 'ict-coord')
   AND NOT grants_login;

-- ----------------------------------------------------------------------------
-- 3. ONE LEAD PER OFFICE PER TENURE.
--
-- assignLeaderAction has always checked this, but a check-then-insert is a race:
-- two VP Admins appointing at the same moment both see no lead and both insert one.
-- Rare, and permanent when it happens — the cabinet then shows two Choir Coords and
-- nothing in the system disagrees.
--
-- Any existing duplicates are demoted to ASSISTANTS rather than deleted. Losing the
-- appointment would lose the record of someone's service; being listed as an
-- assistant is wrong-but-recoverable, and the VP Admin can see it and fix it.
-- ----------------------------------------------------------------------------
UPDATE public.leadership l
   SET is_lead = false
 WHERE l.is_lead
   AND EXISTS (
       SELECT 1 FROM public.leadership other
        WHERE other.tenure_id   = l.tenure_id
          AND other.position_id = l.position_id
          AND other.is_lead
          -- coalesce because created_at is nullable: without it two duplicate rows
          -- that both have a NULL timestamp compare to NULL, neither is demoted, and
          -- the unique index below then refuses to build.
          AND (COALESCE(other.created_at, 'epoch'::timestamptz), other.id)
            < (COALESCE(l.created_at,     'epoch'::timestamptz), l.id)
   );

CREATE UNIQUE INDEX IF NOT EXISTS leadership_one_lead_per_position
    ON public.leadership (tenure_id, position_id)
    WHERE is_lead;

-- ----------------------------------------------------------------------------
-- 4. The units and teams the fellowship has that the portal did not.
--
-- Matched on slug, which is the immutable access-control handle. `sport` already
-- exists: it is RECLASSIFIED to a TEAM, which is what the fellowship's own list
-- says. That is a loosening, not a restriction — as a UNIT it consumed a member's
-- single unit slot (the enforce_single_unit_membership trigger from 0001), so
-- nobody could play for the fellowship and serve in Choir. Existing membership rows
-- are unaffected; they simply stop competing.
-- ----------------------------------------------------------------------------
INSERT INTO public.units (slug, name, type, description, is_workforce)
VALUES
    ('brothers',    'Brothers'' Unit', 'UNIT', 'Ministers to the brothers of the fellowship.', true),
    ('commerce',    'Commerce Team',   'TEAM', 'Runs the fellowship''s trade, sales and commercial ventures.', true),
    ('secretariat', 'Secretariat',     'TEAM', 'Keeps the fellowship''s office, its records and its correspondence.', true),
    ('protocol',    'Protocol Team',   'TEAM', 'Receives and attends to guests, ministers and dignitaries.', true),
    ('transport',   'Transport Team',  'TEAM', 'Arranges movement for fellowship programmes and outreaches.', true)
ON CONFLICT (slug) DO UPDATE
    SET name        = EXCLUDED.name,
        type        = EXCLUDED.type,
        description = EXCLUDED.description;

UPDATE public.units
   SET name = 'Sports Team', type = 'TEAM'
 WHERE slug = 'sport';

-- The ICT unit was likewise reclassified in src/config/fellowship-units.ts; the seed
-- carries it and production needs the same row.
UPDATE public.units
   SET name        = 'Information and Communications Team',
       type        = 'TEAM',
       description = 'Runs the infrastructure, and manages the fellowship''s systems and its communications.'
 WHERE slug = 'ict';

-- ----------------------------------------------------------------------------
-- 5. The offices themselves.
--
-- gen-sec and fin-sec carry NO privilege tags and NO login. They are here so that
-- the member who served as General Secretary is on record as having served, which
-- is the whole reason the fellowship's office list is longer than its list of
-- people who need an account.
--
-- The Exco positions for the new units/teams DO carry EXCO:<slug> and a login:
-- leading a unit means managing its roster in this portal.
-- ----------------------------------------------------------------------------
INSERT INTO public.leadership_positions
    (slug, title, alias, description, tier, is_active, is_protected, grants_login)
VALUES
    ('gen-sec', 'General Secretary', 'Gen Sec',
     'Keeps the fellowship''s minutes, records and correspondence. Honorary in the portal — no access unless the VP Admin grants it.',
     'EXECUTIVE', true, true, false),
    ('fin-sec', 'Financial Secretary', 'Fin Sec',
     'Keeps the fellowship''s accounts. Honorary in the portal — the finances are not held here, so no access unless the VP Admin grants it.',
     'EXECUTIVE', true, true, false),
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
     'EXECUTIVE', true, true, true)
ON CONFLICT (slug) DO UPDATE
    SET title        = EXCLUDED.title,
        alias        = EXCLUDED.alias,
        description  = EXCLUDED.description,
        tier         = EXCLUDED.tier,
        is_protected = true;
-- grants_login is deliberately NOT in the DO UPDATE list: it is the VP Admin's
-- setting, and re-running a migration must not overrule an administrative decision.

-- Titles and aliases that changed with the roster. Slugs are untouched, so no
-- permission moves.
UPDATE public.leadership_positions
   SET title = 'Executive — Sports Team', alias = 'Director of Sports',
       description = 'Leads Sports Team. Adds and removes its members directly.'
 WHERE slug = 'exco-sport';

UPDATE public.leadership_positions SET alias = 'Prayer Secretary'      WHERE slug = 'exco-prayer';
UPDATE public.leadership_positions SET alias = 'Bible Study Secretary' WHERE slug = 'exco-bible-study';

-- ----------------------------------------------------------------------------
-- 6. Privilege tags for the new Exco offices. gen-sec and fin-sec get none.
-- ----------------------------------------------------------------------------
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT p.id, 'EXCO', v.slug
  FROM (VALUES ('brothers'), ('commerce'), ('secretariat'), ('protocol'), ('transport')) AS v(slug)
  JOIN public.leadership_positions p ON p.slug = 'exco-' || v.slug
 WHERE NOT EXISTS (
     SELECT 1 FROM public.position_privileges pp
      WHERE pp.position_id = p.id AND pp.privilege = 'EXCO' AND pp.scope = v.slug
 );

COMMIT;
