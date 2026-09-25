-- ============================================================================
-- The Hall Reps Unit works as a team.
--
-- The fellowship calls it a unit, but a hall rep also serves in their own unit. As a
-- UNIT it took that one unit place (enforce_single_unit_membership refuses a second
-- unit), so a hall rep could not also be in, say, the Choir. As a TEAM they can, and
-- it no longer counts toward the workforce, as teams never do.
--
-- Only the type changes. The name stays "Hall Reps Unit", and the slug and every
-- membership, appointment and access tag are untouched. src/config/fellowship-units.ts
-- and db/seed/default.sql say the same.
--
-- Safe to re-run.
-- ============================================================================

BEGIN;

UPDATE public.units
   SET type = 'TEAM'
 WHERE slug = 'hall-reps'
   AND type <> 'TEAM';

COMMIT;
