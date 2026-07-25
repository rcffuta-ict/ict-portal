-- ============================================================================
-- Migration 0005 — Tenure module (phase 2) schema.
--
-- Depends on 0001–0004. Adds the columns the rebuilt Tenure module needs:
--
--   * tenures.theme                    — the session theme (e.g. "Dominion").
--   * leadership_positions.is_central  — CENTRAL privilege flag. Independent of the
--                                        position's `category`; VP Admin/President can
--                                        mark any position as central. (President and
--                                        the two defaults are central by nature.)
--   * leadership.is_lead               — the primary holder of a position (the
--                                        recognised coordinator). Assistants/sub-leaders
--                                        share the same position with is_lead = false;
--                                        rosters show only the lead.
--   * units.is_workforce               — whether membership in this unit counts toward
--                                        the workforce. "Loose units" (e.g. Sisters Unit)
--                                        are type UNIT but is_workforce = false, so their
--                                        members are NOT workforce. Teams never count.
--   * class_sets.level_override        — optional manual level label overriding the
--                                        computed level (see src/lib/levels.ts). App
--                                        enforces "no two generations share a level";
--                                        a partial unique index guards duplicate overrides.
-- ============================================================================

BEGIN;

ALTER TABLE public.tenures
    ADD COLUMN IF NOT EXISTS theme text;

ALTER TABLE public.leadership_positions
    ADD COLUMN IF NOT EXISTS is_central boolean NOT NULL DEFAULT false;

-- PRESIDENT and CENTRAL-category positions (incl. VP Admin) are central by nature.
UPDATE public.leadership_positions
SET is_central = true
WHERE category = 'PRESIDENT' OR category = 'CENTRAL';

-- The ICT Coordinator is the SYSTEM ADMIN — the sole system-admin role. It is an
-- admin (is_default) but it is NOT a central exco; keep it out of central logic/UI.
UPDATE public.leadership_positions
SET is_central = false
WHERE slug = 'ict-coord';

ALTER TABLE public.leadership
    ADD COLUMN IF NOT EXISTS is_lead boolean NOT NULL DEFAULT true;

ALTER TABLE public.units
    ADD COLUMN IF NOT EXISTS is_workforce boolean NOT NULL DEFAULT true;

-- Teams never count toward the workforce.
UPDATE public.units SET is_workforce = false WHERE type = 'TEAM';

ALTER TABLE public.class_sets
    ADD COLUMN IF NOT EXISTS level_override text;

-- No two generations may be pinned to the same level.
CREATE UNIQUE INDEX IF NOT EXISTS class_sets_level_override_key
    ON public.class_sets (level_override)
    WHERE level_override IS NOT NULL;

COMMIT;
