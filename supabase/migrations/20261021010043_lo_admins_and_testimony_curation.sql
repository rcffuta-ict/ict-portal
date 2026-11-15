-- ============================================================================
-- Lo! admins, and curation for testimonies.
--
-- 1. lo_admins -- leaders the System Admin trusts to moderate Lo! (testimonies and
--    Q&A) without any wider portal role. A grant belongs to the tenure it was made in,
--    so it lapses by itself at handover: src/lib/lo-admin.ts only honours a grant for
--    the ACTIVE tenure, held by someone who still leads in it and still has a login.
--    Nothing here provisions a login -- a leader whose office grants none cannot be
--    made a Lo! admin, because moderating needs a portal session.
--
-- 2. testimonies gains `is_featured` / `featured_at` (one testimony pinned to the top
--    of the feed) and `edited_at` / `edited_by_profile_id` (a moderator corrected a
--    typo before publishing, and the author is told so).
--
-- 3. Indexes for the feed's cursor paging and the per-category counts.
--
-- Additive and safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. lo_admins
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lo_admins (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tenure_id   uuid NOT NULL REFERENCES public.tenures(id)  ON DELETE CASCADE,
    granted_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    granted_at  timestamp with time zone NOT NULL DEFAULT now(),
    revoked_at  timestamp with time zone,
    revoked_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.lo_admins IS
    'Leaders appointed by the System Admin to moderate Lo!. Scoped to one tenure; a revoked row is kept as history.';

-- One live grant per person per tenure. Revoked rows stay, so re-granting is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS lo_admins_one_live_grant
    ON public.lo_admins (profile_id, tenure_id)
    WHERE revoked_at IS NULL;

ALTER TABLE public.lo_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lo_admins FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Testimony curation
-- ----------------------------------------------------------------------------
ALTER TABLE public.testimonies
    ADD COLUMN IF NOT EXISTS is_featured          boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS featured_at          timestamp with time zone,
    ADD COLUMN IF NOT EXISTS edited_at            timestamp with time zone,
    ADD COLUMN IF NOT EXISTS edited_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Only a published testimony can be featured. Hiding or rejecting one unfeatures it
-- in the app; this makes the rule hold for any other writer too.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'testimonies_featured_is_approved'
    ) THEN
        UPDATE public.testimonies SET is_featured = false
         WHERE is_featured AND status <> 'approved';
        ALTER TABLE public.testimonies
            ADD CONSTRAINT testimonies_featured_is_approved
            CHECK (NOT is_featured OR status = 'approved');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------
-- The feed and the review queue both page newest-first, by status.
CREATE INDEX IF NOT EXISTS testimonies_status_created_idx
    ON public.testimonies (status, created_at DESC);

-- Category chips count published testimonies only.
CREATE INDEX IF NOT EXISTS testimonies_approved_category_idx
    ON public.testimonies (category)
    WHERE status = 'approved';

COMMIT;
