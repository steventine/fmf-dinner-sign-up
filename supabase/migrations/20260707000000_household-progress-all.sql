-- Set-based version of household_progress covering every student in one call.
-- Replaces the per-student RPC loop (N+1) on the public schedule, admin overview,
-- and below-quota email audience.
CREATE OR REPLACE FUNCTION public.household_progress_all(_season integer)
 RETURNS TABLE(
   student_id uuid,
   required integer,
   signed_up integer,
   approved_buyouts integer,
   pending_buyouts integer,
   provided integer
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    st.id,
    COALESCE(st.dinners_required, (SELECT default_dinners_required FROM public.settings WHERE id = 1))::INT,
    COALESCE(su.c, 0)::INT,
    COALESCE(ba.c, 0)::INT,
    COALESCE(bp.c, 0)::INT,
    (COALESCE(su.c, 0) + COALESCE(ba.c, 0))::INT
  FROM public.students st
  LEFT JOIN (
    SELECT su.student_id, COUNT(*)::INT AS c
    FROM public.sign_ups su
    JOIN public.meetings m ON m.id = su.meeting_id
    WHERE su.cancelled_at IS NULL AND m.season_year = _season
    GROUP BY su.student_id
  ) su ON su.student_id = st.id
  LEFT JOIN (
    SELECT student_id, SUM(dinners)::INT AS c
    FROM public.buy_outs
    WHERE season_year = _season AND approved = true
    GROUP BY student_id
  ) ba ON ba.student_id = st.id
  LEFT JOIN (
    SELECT student_id, SUM(dinners)::INT AS c
    FROM public.buy_outs
    WHERE season_year = _season AND approved = false
    GROUP BY student_id
  ) bp ON bp.student_id = st.id;
$function$;

-- Same posture as household_progress: only ever called via the service-role client.
REVOKE EXECUTE ON FUNCTION public.household_progress_all(INT) FROM PUBLIC, anon, authenticated;
