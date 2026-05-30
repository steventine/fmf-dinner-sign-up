ALTER TABLE public.sign_ups ADD COLUMN IF NOT EXISTS dinner text;

CREATE OR REPLACE VIEW public.v_meeting_status AS
SELECT
  m.id AS meeting_id,
  m.date,
  m.day_of_week,
  m.season_year,
  m.notes,
  st.id AS student_id,
  st.name AS household_name,
  su.dinner AS dinner
FROM public.meetings m
LEFT JOIN public.sign_ups su ON su.meeting_id = m.id AND su.cancelled_at IS NULL
LEFT JOIN public.students st ON st.id = su.student_id;

ALTER VIEW public.v_meeting_status SET (security_invoker = true);