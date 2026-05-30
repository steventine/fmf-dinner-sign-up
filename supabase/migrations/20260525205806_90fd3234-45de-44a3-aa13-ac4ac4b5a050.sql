
-- Extensions
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin');

-- Tables
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1,
  default_dinners_required INT NOT NULL DEFAULT 2,
  buyout_price NUMERIC(10,2) NOT NULL DEFAULT 100.00,
  season_start DATE,
  season_end DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);
INSERT INTO public.settings (id) VALUES (1);

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  dinners_required INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  unique_guid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX parents_student_idx ON public.parents(student_id);

CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  day_of_week TEXT NOT NULL,
  season_year INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meetings_season_idx ON public.meetings(season_year);

CREATE TABLE public.sign_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);
-- Exactly one active household per meeting
CREATE UNIQUE INDEX sign_ups_one_per_meeting
  ON public.sign_ups(meeting_id)
  WHERE cancelled_at IS NULL;
CREATE INDEX sign_ups_student_idx ON public.sign_ups(student_id) WHERE cancelled_at IS NULL;
CREATE INDEX sign_ups_parent_idx ON public.sign_ups(parent_id);

CREATE TABLE public.buy_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  season_year INT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ
);
CREATE INDEX buy_outs_student_idx ON public.buy_outs(student_id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Role check helper (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Household progress helper
CREATE OR REPLACE FUNCTION public.household_progress(_student_id UUID, _season INT)
RETURNS TABLE (
  required INT,
  signed_up INT,
  approved_buyouts INT,
  pending_buyouts INT,
  provided INT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    SELECT COUNT(*)::INT AS c
    FROM public.buy_outs
    WHERE student_id = _student_id AND season_year = _season AND approved = true
  ),
  bp AS (
    SELECT COUNT(*)::INT AS c
    FROM public.buy_outs
    WHERE student_id = _student_id AND season_year = _season AND approved = false
  )
  SELECT s.req, su.c, ba.c, bp.c, (su.c + ba.c)
  FROM s, su, ba, bp;
$$;

-- Public aggregated view: meeting -> household signed up (name only)
CREATE OR REPLACE VIEW public.v_meeting_status AS
SELECT
  m.id AS meeting_id,
  m.date,
  m.day_of_week,
  m.season_year,
  m.notes,
  st.id AS student_id,
  st.name AS household_name
FROM public.meetings m
LEFT JOIN public.sign_ups su ON su.meeting_id = m.id AND su.cancelled_at IS NULL
LEFT JOIN public.students st ON st.id = su.student_id;

-- Enable RLS on all tables
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sign_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buy_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Public read policies (safe data)
CREATE POLICY "Anyone can view settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Anyone can view meetings" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Anyone can view household names" ON public.students FOR SELECT USING (true);

-- parents, sign_ups, buy_outs, user_roles: NO public/anon read access.
-- Server functions use the service-role admin client to read these for parent guid auth
-- and for admin queries. Admin policies below allow logged-in admins direct read.

-- Admin full-access policies
CREATE POLICY "Admins manage settings" ON public.settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage students" ON public.students FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage parents" ON public.parents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage meetings" ON public.meetings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage sign_ups" ON public.sign_ups FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage buy_outs" ON public.buy_outs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view roles" ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);
