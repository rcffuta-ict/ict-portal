-- ============================================================================
-- Tenure identity, honorary offices, and the Workforce data it needs
-- ============================================================================
--
-- WHAT A TENURE IS
--
-- A tenure is its SESSION (2026/2027), its THEME (Arise and Shine) and its TEXT (the
-- Bible reference the theme is drawn from, John 1:1-3). It has no name. `name` was a
-- third label for a thing that already had two, and it held whatever somebody typed
-- ("Staging", "Dominion").
--
-- Here the app stops needing `name`: the column becomes nullable and nothing new writes
-- it. 20260924115410_drop_tenure_name.sql then drops it, in the same release, which is
-- therefore MAJOR. (A rollback of the app to a build older than this change would meet
-- a missing column — roll forward instead.)
--
-- CORONATION
--
-- The theme is unveiled at coronation (the retreat). So "no theme" is not missing data;
-- it is a true statement that the tenure has not been coronated yet. A tenure is
-- coronated exactly when it has a theme.
--
-- The coronation DATE is its own fact. The retreat happens some time after the session
-- starts, so `start_date` says nothing about it, and neither does the moment somebody
-- filled in the form. `coronated_on` is the day of the retreat, entered by whoever
-- records the coronation. For tenures themed before this change it is NULL -- unknown
-- rather than invented -- and the Tenure page asks for it.
--
-- The banner, icon and palette are each optional. A coronation can be recorded on
-- retreat day before the banner is finished, and each missing asset falls back to the
-- brand on its own. `theme_text` is required by the coronation form but not here,
-- because tenures themed before this change have no reference on record.
--
-- HONORARY OFFICES
--
-- An office that controls no unit or team is honorary. The General and Financial
-- Secretaries already are: no privilege tags, and so no portal login by default. The
-- Secretariat Keeper was built the other way -- derived from a `secretariat` TEAM, with
-- EXCO:secretariat and a login -- which put an honorary office in the Workforce module
-- with a roster nobody manages. This migration makes it match gen-sec and fin-sec.
--
-- The seed cannot do that on its own: it never deletes, and it sets grants_login on
-- INSERT only. So the change to existing databases happens here, and
-- db/seed/default.sql is regenerated in the same commit so it never puts it back.
--
-- WORKFORCE
--
--   membership_events   who added or removed a member, and when. Unit membership had
--                       no audit trail at all.
--   rcf_birthdays()     birthdays in a month, computed in SQL so every date of birth
--                       is not shipped to the server just to filter by month.
--   invite_events       gains 'copied': an exco copying a coordinator's update link
--                       is handing out a credential, so it is logged.
--
-- Idempotent and re-runnable, like the rest of the series.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The tenure's identity columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.tenures
    ADD COLUMN IF NOT EXISTS theme_text       text,
    ADD COLUMN IF NOT EXISTS theme_banner_url text,
    ADD COLUMN IF NOT EXISTS theme_icon_url   text,
    ADD COLUMN IF NOT EXISTS theme_palette    jsonb,
    ADD COLUMN IF NOT EXISTS coronated_on           date,
    ADD COLUMN IF NOT EXISTS coronation_recorded_by uuid;

-- SET NULL, not CASCADE: whoever recorded the coronation may leave the fellowship, and
-- that must not take the session's identity with them.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenures_coronation_recorded_by_fkey'
    ) THEN
        ALTER TABLE public.tenures
            ADD CONSTRAINT tenures_coronation_recorded_by_fkey
            FOREIGN KEY (coronation_recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN public.tenures.theme IS
    'The session''s theme, unveiled at coronation. NULL = not yet coronated.';
COMMENT ON COLUMN public.tenures.theme_text IS
    'The Bible reference the theme is drawn from, e.g. John 1:1-3. A reference, not the verse; stored as typed.';
COMMENT ON COLUMN public.tenures.theme_palette IS
    'Optional {primary, primaryLight, accent} as #rrggbb. Validated (format and WCAG AA contrast) in the app; the dashboard falls back to the brand when absent.';
COMMENT ON COLUMN public.tenures.coronated_on IS
    'The day of the coronation retreat. Not the session''s start date. NULL on tenures themed before it was recorded.';
COMMENT ON COLUMN public.tenures.coronation_recorded_by IS
    'Who entered the coronation in the portal.';

-- ----------------------------------------------------------------------------
-- 2. Backfill: existing themes are coronations whose date is unknown
-- ----------------------------------------------------------------------------
--
-- A blank theme is no theme. Normalise first so "   " cannot count as a coronation.
UPDATE public.tenures SET theme = NULLIF(btrim(theme), '')
 WHERE theme IS NOT NULL AND theme IS DISTINCT FROM NULLIF(btrim(theme), '');

-- A theme already on record was unveiled at some point, but nothing says when: the
-- retreat is not the session's start date. Left NULL and reported, so the date is
-- entered by somebody who knows it rather than guessed here.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT session, theme FROM public.tenures
         WHERE theme IS NOT NULL AND coronated_on IS NULL
         ORDER BY start_date
    LOOP
        RAISE NOTICE 'Tenure % is coronated ("%") but its coronation date is not on record. Add it from the Tenure page.',
            r.session, r.theme;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. `name` stops being required -- and is NOT copied anywhere
-- ----------------------------------------------------------------------------
--
-- A name is not tenure information, and copying "Staging" into `theme` would falsely
-- declare a coronation. Every name that is about to stop being shown is reported, so
-- the VP Admin knows which sessions to coronate from the Tenure page. The values also
-- survive in every backup taken before this release.
--
-- Guarded on the column existing, so this block stays harmless once the follow-up
-- migration has dropped it.
DO $$
DECLARE
    r record;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'tenures' AND column_name = 'name'
    ) THEN
        FOR r IN EXECUTE
            'SELECT session, name, theme FROM public.tenures
              WHERE name IS NOT NULL AND name IS DISTINCT FROM theme
              ORDER BY start_date'
        LOOP
            RAISE NOTICE 'Tenure % was named "%"; the name is no longer shown. It now reads as %.',
                r.session, r.name,
                CASE WHEN r.theme IS NULL THEN 'awaiting coronation' ELSE '"' || r.theme || '"' END;
        END LOOP;

        ALTER TABLE public.tenures ALTER COLUMN name DROP NOT NULL;
        COMMENT ON COLUMN public.tenures.name IS
            'DEPRECATED. No longer read or written by the app; dropped by 20260924115410_drop_tenure_name.sql.';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. The states a tenure can be in
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- A theme is never blank: "   " would read as coronated.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenures_theme_not_blank') THEN
        ALTER TABLE public.tenures ADD CONSTRAINT tenures_theme_not_blank
            CHECK (theme IS NULL OR btrim(theme) <> '');
    END IF;

    -- Nothing theme-shaped exists without a theme -- including a coronation date:
    -- a tenure cannot have been coronated with no theme unveiled.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenures_theme_details_need_theme') THEN
        ALTER TABLE public.tenures ADD CONSTRAINT tenures_theme_details_need_theme
            CHECK (theme IS NOT NULL
                   OR (theme_text IS NULL AND theme_banner_url IS NULL
                       AND theme_icon_url IS NULL AND theme_palette IS NULL
                       AND coronated_on IS NULL AND coronation_recorded_by IS NULL));
    END IF;

    -- Shape and contrast are checked in the app (src/lib/palette.ts); the database
    -- only refuses what can never be a palette.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenures_palette_is_object') THEN
        ALTER TABLE public.tenures ADD CONSTRAINT tenures_palette_is_object
            CHECK (theme_palette IS NULL OR jsonb_typeof(theme_palette) = 'object');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. The Secretariat Keeper is an honorary office
-- ----------------------------------------------------------------------------
--
-- Same slug: existing appointments and service records point at it by id and read it
-- by slug, so it keeps both. Only what it IS changes.
UPDATE public.leadership_positions
   SET title       = 'Secretariat Keeper',
       alias       = 'Secretariat Keeper',
       description = 'An executive seat honouring the Secretariat Keeper. Honorary in the portal — no access unless the VP Admin grants it.',
       tier        = 'EXECUTIVE'
 WHERE slug = 'exco-secretariat';

DO $$
DECLARE
    v_position_id uuid;
    v_tenure_id   uuid;
    v_unit_id     uuid;
    v_count       int;
    v_sessions    int := 0;
    v_logins      int := 0;
    r             record;
BEGIN
    SELECT id INTO v_position_id FROM public.leadership_positions WHERE slug = 'exco-secretariat';
    IF v_position_id IS NULL THEN
        RETURN;  -- a database that never had the office has nothing to change
    END IF;

    -- 5a. An honorary office carries no privilege tags. This is the line that takes it
    --     out of Workforce: module access and canManageUnit() both read these tags.
    DELETE FROM public.position_privileges WHERE position_id = v_position_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
        RAISE NOTICE 'Secretariat Keeper: removed % privilege tag(s); the office is now honorary.', v_count;
    END IF;

    -- 5b. And no login. This overrides the VP Admin's setting exactly once, which is
    --     safe because nobody chose it: the office got a login in 20260920162209 only
    --     because it was derived from a team. "Once" is keyed on the tags just
    --     removed -- they exist only before the first run -- so re-running this never
    --     overrules a VP Admin who has since switched the login back on.
    IF v_count > 0 THEN
        UPDATE public.leadership_positions SET grants_login = false
         WHERE id = v_position_id AND grants_login;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN
            RAISE NOTICE 'Secretariat Keeper: portal login switched off by default. The VP Admin can switch it back on from the cabinet screen.';
        END IF;

        -- 5c. Revoke current holders' access -- mirroring deprovisionLoginIfUnappointed()
        --     in src/lib/auth/provision.ts exactly: only current holders in the active
        --     tenure, and only if they hold no OTHER current office that grants a
        --     login. A Keeper who also leads a unit keeps their access. With no active
        --     tenure, leave access alone, as the app does.
        SELECT id INTO v_tenure_id FROM public.tenures WHERE is_active LIMIT 1;
        IF v_tenure_id IS NOT NULL THEN
            FOR r IN
                SELECT DISTINCT l.profile_id
                  FROM public.leadership l
                 WHERE l.position_id = v_position_id
                   AND l.tenure_id = v_tenure_id
                   AND l.ended_at IS NULL
                   AND NOT EXISTS (
                       SELECT 1
                         FROM public.leadership o
                         JOIN public.leadership_positions op ON op.id = o.position_id
                        WHERE o.profile_id = l.profile_id
                          AND o.tenure_id = v_tenure_id
                          AND o.ended_at IS NULL
                          AND op.grants_login)
            LOOP
                -- revoked_at, not DELETE: the audit trigger turns each revocation into a
                -- session_revoked login event (revokeAllSessions() does the same).
                UPDATE public.auth_sessions
                   SET revoked_at = now(), revoked_reason = 'leadership_removed'
                 WHERE profile_id = r.profile_id AND revoked_at IS NULL;
                GET DIAGNOSTICS v_count = ROW_COUNT;
                v_sessions := v_sessions + v_count;

                DELETE FROM public.profile_login WHERE profile_id = r.profile_id;
                GET DIAGNOSTICS v_count = ROW_COUNT;
                v_logins := v_logins + v_count;
            END LOOP;

            IF v_logins > 0 OR v_sessions > 0 THEN
                RAISE NOTICE 'Secretariat Keeper: removed % login(s) and revoked % session(s) of holders with no other office that grants access.',
                    v_logins, v_sessions;
            END IF;
        END IF;
    END IF;

    -- 5d. The Secretariat team goes with it: an honorary office controls no team, and
    --     a team nobody manages is dead weight in every picker. Only removed when
    --     nothing refers to it -- deleting would otherwise cascade into memberships
    --     or transfer requests, or fail on a leadership row.
    SELECT id INTO v_unit_id FROM public.units WHERE slug = 'secretariat';
    IF v_unit_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.membership_units        WHERE unit_id = v_unit_id)
        OR EXISTS (SELECT 1 FROM public.leadership              WHERE unit_id = v_unit_id)
        OR EXISTS (SELECT 1 FROM public.unit_positions          WHERE unit_id = v_unit_id)
        OR EXISTS (SELECT 1 FROM public.unit_transfer_requests
                    WHERE from_unit_id = v_unit_id OR to_unit_id = v_unit_id)
        OR EXISTS (SELECT 1 FROM public.position_privileges     WHERE scope = 'secretariat')
        THEN
            RAISE NOTICE 'The Secretariat team is still referenced (members, appointments, transfers or privileges), so it was kept. Remove those, then delete the team.';
        ELSE
            DELETE FROM public.units WHERE id = v_unit_id;
            RAISE NOTICE 'Removed the Secretariat team; the Secretariat Keeper is honorary and controls no team.';
        END IF;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. membership_events -- who added whom to a unit, and when
-- ----------------------------------------------------------------------------
--
-- Same shape as invite_events and login_events. `actor_name` is a snapshot, so the
-- log still reads correctly after the actor's profile is gone (actor_id goes NULL).
CREATE TABLE IF NOT EXISTS public.membership_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    unit_id     uuid NOT NULL REFERENCES public.units(id)    ON DELETE CASCADE,
    tenure_id   uuid NOT NULL REFERENCES public.tenures(id)  ON DELETE CASCADE,
    action      text NOT NULL
                    CHECK (action = ANY (ARRAY['added', 'removed', 'transferred_in',
                                               'transferred_out', 'carried_over'])),
    actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name  text,
    created_at  timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.membership_events IS
    'Audit trail of unit membership changes. Written by the app from every path that changes membership_units.';

-- The per-unit log, newest first, is the only read.
CREATE INDEX IF NOT EXISTS membership_events_unit_log_idx
    ON public.membership_events (unit_id, tenure_id, created_at DESC);

ALTER TABLE public.membership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_events FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 7. rcf_birthdays -- who is celebrating in a given month
-- ----------------------------------------------------------------------------
--
-- Takes the roster as ids rather than a unit, because the roster is not always rows in
-- membership_units: the Brothers' and Sisters' units are computed from gender, and
-- that rule lives in the app (src/config/fellowship-units.ts). The app resolves the
-- roster it is already allowed to see and asks only for the birthdays in it.
--
-- 29 February is celebrated on 28 February in years that are not leap years, and on
-- the 29th in leap years. Returns the day only -- never the year of birth.
CREATE OR REPLACE FUNCTION public.rcf_birthdays(
    p_profile_ids uuid[],
    p_month       int,
    p_year        int)
RETURNS TABLE (
    profile_id    uuid,
    first_name    text,
    last_name     text,
    avatar_url    text,
    celebrate_day int)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT p.id,
           p.first_name,
           p.last_name,
           p.avatar_url,
           CASE
               WHEN extract(month FROM p.dob) = 2 AND extract(day FROM p.dob) = 29
                    AND NOT ((p_year % 4 = 0 AND p_year % 100 <> 0) OR p_year % 400 = 0)
                   THEN 28
               ELSE extract(day FROM p.dob)::int
           END AS celebrate_day
      FROM public.profiles p
     WHERE p.id = ANY (p_profile_ids)
       AND p.dob IS NOT NULL
       AND p_month BETWEEN 1 AND 12
       AND extract(month FROM p.dob) = p_month
     ORDER BY celebrate_day, p.last_name, p.first_name;
$$;

-- Server-only, like every other rcf_ function: the service-role client calls it after
-- the caller's access to the roster has been checked.
REVOKE ALL ON FUNCTION public.rcf_birthdays(uuid[], int, int) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. invite_events: 'copied'
-- ----------------------------------------------------------------------------
--
-- An exco may copy a level coordinator's update link for one of their members, but
-- never mint one. Copying still hands out a credential, so each copy is recorded.
ALTER TABLE public.invite_events DROP CONSTRAINT IF EXISTS invite_events_action_check;
ALTER TABLE public.invite_events ADD CONSTRAINT invite_events_action_check
    CHECK (action = ANY (ARRAY['generated', 'revoked', 'register', 'update', 'copied']));

COMMIT;
