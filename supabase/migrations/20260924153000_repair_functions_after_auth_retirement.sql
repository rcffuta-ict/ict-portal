-- ============================================================================
-- Repair three functions broken by Supabase Auth's retirement and by 0013
-- ============================================================================
--
-- WHAT WAS BROKEN
--
-- cluster_questions and toggle_question_visibility (Lo!) began with an admin check:
--
--     WHERE l.profile_id = auth.uid() AND lp.category IN ('PRESIDENT','CENTRAL')
--
-- Two things killed it. Supabase Auth is retired: the app talks to the database with
-- the service-role key, so `auth.uid()` is always NULL and the check always refused.
-- Then migration 0013 dropped `leadership_positions.category`, so the check now
-- errors instead. Clustering and hiding questions have not worked since.
--
-- search_members_detailed read the same dropped column, and joined `auth.users` for
-- the email — the retired table, not `profiles.email`. It powers member search in the
-- Tenure console, including the handover wizard's choice of incoming VP Admin and ICT
-- Coordinator, so a handover could not be completed.
--
-- `supabase db lint` in CI has flagged all three since 0013 landed.
--
-- THE SHAPE OF THE FIX
--
-- Authorization moves to where every other check in this app lives: the server
-- action, which reads the real session (checkEnhancedAdminAccess for Lo!,
-- requireModuleRead("tenure") for member search). The functions themselves:
--
--   * lose the dead auth.uid() check;
--   * become SECURITY INVOKER — the service role needs no elevation;
--   * are callable by the service role ONLY. They were granted to anon and
--     authenticated, which for a SECURITY DEFINER function that writes is a door
--     left open; revoking closes it, like every rcf_ function in this series.
--
-- search_members_detailed keeps its name and JSON shape (the app reads id, names,
-- email, phone_number, department, level, avatar_url, units, teams, leadership) and
-- is rebuilt on today's schema: email from profiles, level from rcf_compute_level,
-- office kind from rcf_position_kind, memberships and appointments of the ACTIVE
-- tenure only, ended appointments excluded. It now matches the term literally —
-- `%` and `_` typed into a search box are not wildcards — and returns at most 25.
--
-- Idempotent: CREATE OR REPLACE, and grants are set, not accumulated.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. cluster_questions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cluster_questions(
    question_ids uuid[],
    cluster_uuid uuid DEFAULT gen_random_uuid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    -- Authorized by the caller (clusterQuestions → checkEnhancedAdminAccess).
    UPDATE public.event_questions
       SET cluster_id = cluster_uuid, updated_at = now()
     WHERE id = ANY (question_ids);
    RETURN cluster_uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.cluster_questions(uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cluster_questions(uuid[], uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. toggle_question_visibility
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_question_visibility(
    question_id uuid,
    new_status public.question_status)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    -- Authorized by the caller (toggleVisibility → checkEnhancedAdminAccess).
    UPDATE public.event_questions
       SET status = new_status, updated_at = now()
     WHERE id = question_id;
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_question_visibility(uuid, public.question_status)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_question_visibility(uuid, public.question_status)
    TO service_role;

-- ----------------------------------------------------------------------------
-- 3. search_members_detailed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_members_detailed(query_text text)
RETURNS SETOF json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_tenure_id uuid;
    v_session   text;
    v_term      text := lower(btrim(coalesce(query_text, '')));
BEGIN
    -- Too short to mean anything; don't hand back the first 25 members of the roster.
    IF length(v_term) < 2 THEN
        RETURN;
    END IF;

    SELECT id, session INTO v_tenure_id, v_session
      FROM public.tenures WHERE is_active LIMIT 1;

    RETURN QUERY
    SELECT json_build_object(
        'id', p.id,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'email', p.email,
        'phone_number', p.phone_number,
        'avatar_url', p.avatar_url,
        'department', p.department,
        'level', CASE
            WHEN cs.id IS NULL THEN 'N/A'
            ELSE COALESCE(
                cs.level_override,
                public.rcf_compute_level(cs.entry_year, COALESCE(cs.is_foundation, false), v_session),
                'N/A')
        END,
        'units', COALESCE((
            SELECT json_agg(u.name ORDER BY u.name)
              FROM public.membership_units mu
              JOIN public.units u ON u.id = mu.unit_id
             WHERE mu.profile_id = p.id AND mu.tenure_id = v_tenure_id AND u.type = 'UNIT'
        ), '[]'::json),
        'teams', COALESCE((
            SELECT json_agg(u.name ORDER BY u.name)
              FROM public.membership_units mu
              JOIN public.units u ON u.id = mu.unit_id
             WHERE mu.profile_id = p.id AND mu.tenure_id = v_tenure_id AND u.type = 'TEAM'
        ), '[]'::json),
        'leadership', COALESCE((
            SELECT json_agg(json_build_object(
                       'title', lp.title,
                       'category', public.rcf_position_kind(lp.id)))
              FROM public.leadership l
              JOIN public.leadership_positions lp ON lp.id = l.position_id
             WHERE l.profile_id = p.id AND l.tenure_id = v_tenure_id AND l.ended_at IS NULL
        ), '[]'::json)
    )
      FROM public.profiles p
      LEFT JOIN public.class_sets cs ON cs.id = p.class_set_id
     -- strpos, not ILIKE: a literal substring match, so `%` or `_` in the search box
     -- mean themselves rather than "anything".
     WHERE strpos(lower(coalesce(p.first_name, '')), v_term) > 0
        OR strpos(lower(coalesce(p.last_name, '')), v_term) > 0
        OR strpos(lower(coalesce(p.email, '')), v_term) > 0
        OR strpos(lower(coalesce(p.phone_number, '')), v_term) > 0
     ORDER BY p.first_name, p.last_name
     LIMIT 25;
END;
$$;

REVOKE ALL ON FUNCTION public.search_members_detailed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_members_detailed(text) TO service_role;

COMMIT;
