
ALTER TABLE public.buy_outs
  ADD COLUMN dinners integer NOT NULL DEFAULT 1
  CHECK (dinners >= 1 AND dinners <= 50);

-- Backfill from amount / current buyout_price
UPDATE public.buy_outs bo
SET dinners = GREATEST(1, ROUND(bo.amount / NULLIF(s.buyout_price, 0))::int)
FROM public.settings s
WHERE s.id = 1 AND s.buyout_price > 0;

-- Update household_progress to SUM dinners
CREATE OR REPLACE FUNCTION public.household_progress(_student_id uuid, _season integer)
 RETURNS TABLE(required integer, signed_up integer, approved_buyouts integer, pending_buyouts integer, provided integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT COALESCE(st.dinners_required, (SELECT default_dinners_required FROM public.settings WHERE id = 1)) AS req
    FROM public.students st WHERE st.id = _student_id
  ),
  su AS (
    SELECT COUNT(*)::INT AS c
    FROM public.sign_ups su
    JOIN public.meetings m ON m.id = su.meeting_id
    WHERE su.student_id = _student_id
      AND su.cancelled_at IS NULL
      AND m.season_year = _season
  ),
  ba AS (
    SELECT COALESCE(SUM(dinners), 0)::INT AS c
    FROM public.buy_outs
    WHERE student_id = _student_id AND season_year = _season AND approved = true
  ),
  bp AS (
    SELECT COALESCE(SUM(dinners), 0)::INT AS c
    FROM public.buy_outs
    WHERE student_id = _student_id AND season_year = _season AND approved = false
  )
  SELECT s.req, su.c, ba.c, bp.c, (su.c + ba.c)
  FROM s, su, ba, bp;
$function$;
