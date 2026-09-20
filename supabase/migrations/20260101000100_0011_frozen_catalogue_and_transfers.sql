-- ============================================================================
-- Migration 0011 — Frozen leadership catalogue + unit transfer requests.
--
-- Depends on 0001–0006 (leadership_positions, position_privileges, units.slug,
-- membership_units + its single-unit trigger).
--
-- WHAT CHANGES
--
--   1. leadership_positions.tier        — where a position sits in the hierarchy:
--                                         President → VPs → Executives → Coordinators.
--                                         PRESENTATION AND ORDERING ONLY. Authorization
--                                         remains entirely privilege-tag based; a second
--                                         permission system keyed on tier would drift.
--   2. leadership_positions.is_protected — part of the frozen catalogue.
--   3. A protection trigger — a protected position cannot be DELETED. The catalogue
--      is constant across tenures: handing over swaps the PEOPLE in `leadership`,
--      never the positions. Editing the catalogue is still possible, but it is the
--      VP Admin's job alone, enforced by requireVpAdmin() in the server actions
--      (a trigger cannot tell which human is behind a service-role connection).
--      A position that is no longer needed is DEACTIVATED, not deleted — appointments
--      and module_access reference these rows by id.
--   4. public.unit_transfer_requests + rcf_approve_unit_transfer().
--
-- ON THE 500-LEVEL RULE
--   Finalist coordinators hold authority over every level. That is expressed as the
--   position's privilege scope ('all' instead of '500') — seeded below and mirrored in
--   src/config/leadership-positions.ts. No authorization code special-cases it:
--   canManageLevel() already reads a null-or-'all' scope as "every generation".
--
-- ON UNIT TRANSFERS
--   `enforce_single_unit_membership` (migration 0001) still stands — a member holds at
--   most one UNIT per tenure, teams unlimited. What changes is what happens when an
--   executive tries to claim someone who already belongs elsewhere: instead of the
--   trigger raising, the app queues a request and the member DOES NOT MOVE until the
--   VP Admin approves it. Approval is a single function because deleting the old
--   membership and inserting the new one must be atomic — supabase-js has no
--   cross-statement transaction, and a half-applied transfer leaves a member in two
--   units or none.
--
-- Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Catalogue columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.leadership_positions
    ADD COLUMN IF NOT EXISTS tier text,
    ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leadership_positions_tier_check'
    ) THEN
        ALTER TABLE public.leadership_positions
            ADD CONSTRAINT leadership_positions_tier_check
            CHECK (tier IS NULL OR tier = ANY (ARRAY[
                'PRESIDENT','VP','EXECUTIVE','COORDINATOR','SYSTEM']));
    END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. Seed the FIXED offices. Mirrors FIXED_POSITIONS in
--    src/config/leadership-positions.ts — keep the two in step.
-- ----------------------------------------------------------------------------
INSERT INTO public.leadership_positions
    (slug, title, alias, category, description, is_active, is_default, is_central, tier, is_protected)
VALUES
    ('president', 'President', 'President', 'PRESIDENT',
     'Head of the fellowship. Sees every module including Settings, and is globally write-blocked.',
     true, false, true, 'PRESIDENT', true),
    ('vp-admin', 'Vice President Administration', 'VP Admin', 'CENTRAL',
     'Administrative head. Appoints leaders, approves unit transfers, and runs the handover.',
     true, true, true, 'VP', true),
    ('vp-church-growth', 'Vice President Church Growth', 'VP Church Growth', 'CENTRAL',
     'Growth and outreach head. Church-wide read access.',
     true, false, true, 'VP', true),
    -- The System Admin is an admin but NOT a central exco (migration 0005).
    ('ict-coord', 'ICT Coordinator', 'ICT Coord', 'CENTRAL',
     'System Admin. Full read and write everywhere, including Settings and the Oracle.',
     true, true, false, 'SYSTEM', true)
ON CONFLICT (title) DO UPDATE
    SET slug         = EXCLUDED.slug,
        alias        = EXCLUDED.alias,
        description  = EXCLUDED.description,
        is_active    = true,
        is_default   = EXCLUDED.is_default,
        is_central   = EXCLUDED.is_central,
        tier         = EXCLUDED.tier,
        is_protected = true;

-- Privileges for the fixed offices.
INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'PRESIDENT', NULL FROM public.leadership_positions WHERE slug = 'president'
ON CONFLICT DO NOTHING;

INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'CENTRAL', NULL FROM public.leadership_positions
WHERE slug IN ('vp-admin', 'vp-church-growth')
ON CONFLICT DO NOTHING;

INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'SYSADMIN', NULL FROM public.leadership_positions WHERE slug = 'ict-coord'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Seed the Level Coordinator positions (one per level).
--    NOTE the 500-Level row: scope 'all', not '500'.
-- ----------------------------------------------------------------------------
INSERT INTO public.leadership_positions
    (slug, title, alias, category, description, is_active, is_default, is_central, tier, is_protected)
VALUES
    ('level-coord-pds-uabs', 'Level Coordinator — PDS/UABS', 'PDS/UABS Coord', 'LEVEL',
     'Coordinates PDS/UABS. Authority is limited to that generation.', true, false, false, 'COORDINATOR', true),
    ('level-coord-100', 'Level Coordinator — 100 Level', '100 Level Coord', 'LEVEL',
     'Coordinates 100 Level. Authority is limited to that generation.', true, false, false, 'COORDINATOR', true),
    ('level-coord-200', 'Level Coordinator — 200 Level', '200 Level Coord', 'LEVEL',
     'Coordinates 200 Level. Authority is limited to that generation.', true, false, false, 'COORDINATOR', true),
    ('level-coord-300', 'Level Coordinator — 300 Level', '300 Level Coord', 'LEVEL',
     'Coordinates 300 Level. Authority is limited to that generation.', true, false, false, 'COORDINATOR', true),
    ('level-coord-400', 'Level Coordinator — 400 Level', '400 Level Coord', 'LEVEL',
     'Coordinates 400 Level. Authority is limited to that generation.', true, false, false, 'COORDINATOR', true),
    ('level-coord-all', 'Level Coordinator — 500 Level', '500 Level Coord', 'LEVEL',
     'Coordinates the finalists, and holds coordinator authority over EVERY level in the fellowship.',
     true, false, false, 'COORDINATOR', true)
ON CONFLICT (title) DO UPDATE
    SET slug         = EXCLUDED.slug,
        alias        = EXCLUDED.alias,
        description  = EXCLUDED.description,
        is_active    = true,
        tier         = EXCLUDED.tier,
        is_protected = true;

INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT id, 'LEVEL', substring(slug FROM 'level-coord-(.*)$')
FROM public.leadership_positions
WHERE slug LIKE 'level-coord-%'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Seed one Executive position per existing unit/team, scoped to its slug.
--    New units mint theirs through the app's catalogue sync.
-- ----------------------------------------------------------------------------
INSERT INTO public.leadership_positions
    (slug, title, alias, category, description, is_active, is_default, is_central, tier, is_protected)
SELECT
    'exco-' || u.slug,
    'Executive — ' || u.name,
    u.name || ' Exco',
    CASE WHEN u.type = 'TEAM' THEN 'TEAM' ELSE 'UNIT' END,
    'Leads ' || u.name || '. Adds and removes its members directly.',
    true, false, false, 'EXECUTIVE', true
FROM public.units u
ON CONFLICT (title) DO UPDATE
    SET slug         = EXCLUDED.slug,
        alias        = EXCLUDED.alias,
        is_active    = true,
        tier         = 'EXECUTIVE',
        is_protected = true;

INSERT INTO public.position_privileges (position_id, privilege, scope)
SELECT lp.id, 'EXCO', u.slug
FROM public.leadership_positions lp
JOIN public.units u ON ('exco-' || u.slug) = lp.slug
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. PROTECT the catalogue — frozen in shape, editable by the VP Admin.
--
--    "Frozen" here means the structure is CONSTANT ACROSS TENURES: handing over
--    swaps the people in `leadership`, never the positions themselves. It does not
--    mean nobody can ever change it — the VP Admin owns the org chart and can edit
--    titles, descriptions and privileges when the fellowship genuinely restructures.
--
--    That "only the VP Admin" rule is enforced in the SERVER ACTIONS
--    (requireVpAdmin in src/lib/access-control.ts), not here: a trigger sees a
--    service-role connection and has no idea which human is behind it, so faking
--    caller identity into a session variable would be security theatre.
--
--    What the database DOES enforce is the one rule no role should be able to break:
--    a protected position cannot be DELETED. Appointments, privilege grants and the
--    module-access config all reference these rows by id, and deleting one silently
--    strips authority from whoever holds it. Deactivate it instead — the catalogue
--    keeps its shape and the position simply sits vacant.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_frozen_position_catalogue()
RETURNS trigger AS $$
BEGIN
    IF OLD.is_protected THEN
        RAISE EXCEPTION
            'Position "%" belongs to the fellowship catalogue and cannot be deleted. Deactivate it instead — it will stay in the structure but sit vacant.',
            OLD.title;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_frozen_position_catalogue ON public.leadership_positions;
CREATE TRIGGER trg_frozen_position_catalogue
    BEFORE DELETE ON public.leadership_positions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_frozen_position_catalogue();

-- Privileges of a protected position stay editable (the VP Admin re-scopes an Exco
-- when units are reorganised); the app gate is the control, as above.
DROP TRIGGER IF EXISTS trg_frozen_position_privileges ON public.position_privileges;
DROP FUNCTION IF EXISTS public.enforce_frozen_position_privileges();

-- ----------------------------------------------------------------------------
-- 6. unit_transfer_requests
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unit_transfer_requests (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenure_id      uuid NOT NULL REFERENCES public.tenures(id) ON DELETE CASCADE,
    from_unit_id   uuid REFERENCES public.units(id) ON DELETE SET NULL,
    to_unit_id     uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    requested_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    requested_at   timestamptz NOT NULL DEFAULT now(),
    status         text NOT NULL DEFAULT 'pending'
                       CHECK (status = ANY (ARRAY['pending','approved','declined','cancelled'])),
    decided_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    decided_at     timestamptz,
    decline_reason text
);

-- A member can be the subject of at most ONE open request per tenure, so two
-- executives racing for the same person can't queue two competing transfers.
CREATE UNIQUE INDEX IF NOT EXISTS unit_transfer_requests_one_pending
    ON public.unit_transfer_requests (profile_id, tenure_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS unit_transfer_requests_queue_idx
    ON public.unit_transfer_requests (tenure_id, status, requested_at DESC);

ALTER TABLE public.unit_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_transfer_requests FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 7. Approving a transfer — one atomic step.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rcf_approve_unit_transfer(
    p_request_id uuid,
    p_decided_by uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_req public.unit_transfer_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_req FROM public.unit_transfer_requests
    WHERE id = p_request_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer request not found.';
    END IF;
    IF v_req.status <> 'pending' THEN
        RAISE EXCEPTION 'That transfer has already been %.', v_req.status;
    END IF;

    -- Drop every UNIT membership this member holds in the tenure (there is at most
    -- one, by enforce_single_unit_membership) before inserting the new one, so the
    -- trigger sees a clean slate rather than rejecting the move.
    DELETE FROM public.membership_units mu
    USING public.units u
    WHERE mu.unit_id = u.id
      AND mu.profile_id = v_req.profile_id
      AND mu.tenure_id  = v_req.tenure_id
      AND u.type = 'UNIT';

    INSERT INTO public.membership_units (profile_id, unit_id, tenure_id)
    VALUES (v_req.profile_id, v_req.to_unit_id, v_req.tenure_id);

    UPDATE public.unit_transfer_requests
    SET status = 'approved', decided_by = p_decided_by, decided_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'profileId', v_req.profile_id,
        'fromUnitId', v_req.from_unit_id,
        'toUnitId', v_req.to_unit_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rcf_approve_unit_transfer(uuid, uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.unit_transfer_requests IS
    'Pending moves between units. The member does not move until the VP Admin approves.';

COMMIT;
