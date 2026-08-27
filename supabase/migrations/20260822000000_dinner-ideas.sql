-- Dinner ideas: crowd-sourced notes about what to bring, organized by source.
-- A source is either a restaurant you order from or a dish you make at home;
-- both accumulate notes, but only restaurants carry contact details.

CREATE TABLE public.dinner_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('restaurant', 'homemade')),
  name TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  order_lead_time TEXT,
  delivers BOOLEAN,
  created_by_parent_id UUID REFERENCES public.parents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness per kind, so "Dominos" and "dominos" can't both exist.
-- The same name may legitimately appear as both a restaurant and a dish (e.g. "Chili").
CREATE UNIQUE INDEX dinner_sources_name_kind_idx
  ON public.dinner_sources (lower(name), kind);

CREATE TABLE public.dinner_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.dinner_sources(id) ON DELETE CASCADE,
  -- NULL for notes the team posts to seed the page; those render as "FullMetal Falcons".
  parent_id UUID REFERENCES public.parents(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  served_count INT CHECK (served_count IS NULL OR (served_count > 0 AND served_count <= 500)),
  total_cost NUMERIC(10,2) CHECK (total_cost IS NULL OR total_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Hidden rather than deleted, so an admin can undo a moderation call.
  hidden_at TIMESTAMPTZ,
  hidden_by UUID
);
CREATE INDEX dinner_notes_source_idx
  ON public.dinner_notes(source_id)
  WHERE hidden_at IS NULL;
CREATE INDEX dinner_notes_created_idx ON public.dinner_notes(created_at DESC);
CREATE INDEX dinner_notes_parent_idx ON public.dinner_notes(parent_id);

CREATE TABLE public.dinner_note_votes (
  note_id UUID NOT NULL REFERENCES public.dinner_notes(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, parent_id)
);

-- Parents reach all three tables only through GUID-validated server functions
-- using the service-role client, so no anon/authenticated policies are granted.
ALTER TABLE public.dinner_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinner_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinner_note_votes ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.dinner_sources TO service_role;
GRANT ALL ON public.dinner_notes TO service_role;
GRANT ALL ON public.dinner_note_votes TO service_role;

CREATE POLICY "Admins manage dinner sources"
  ON public.dinner_sources FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage dinner notes"
  ON public.dinner_notes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage dinner note votes"
  ON public.dinner_note_votes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Follow-up email ─────────────────────────────────────────────────────────
-- Asks the household that served how it went, the morning after the meeting.

ALTER TABLE public.sign_ups
  ADD COLUMN followed_up_at TIMESTAMPTZ;

CREATE INDEX sign_ups_followup_idx
  ON public.sign_ups(followed_up_at)
  WHERE cancelled_at IS NULL AND followed_up_at IS NULL;

-- Installed switched off: NULL disables the follow-up entirely, matching how
-- reminder_days_before works. Turn it on with the Enabled toggle in the email tab.
ALTER TABLE public.email_templates
  ADD COLUMN follow_up_days_after SMALLINT;

INSERT INTO public.email_templates
  (key, name, description, subject, markdown_body, available_variables, template_type, follow_up_days_after)
VALUES
('dinner_followup',
 'Dinner follow-up',
 'Asks the household that provided dinner to share what they brought, a day after the meeting.',
 'How did dinner go on {{meeting_date}}?',
 'Hi {{parent_name}},

Thanks for providing dinner on **{{meeting_date}}** — you brought **{{dinner}}**.

While it''s fresh: would you take a minute to tell the next family what you did? How much food you got, what it cost, who you called, what you''d do differently. It''s the single most useful thing for the parent signing up next month.

[Share what you brought]({{link_url}})

Thanks for supporting the FullMetal Falcons!',
 ARRAY['parent_name','student_name','meeting_date','dinner','link_url'],
 'transactional',
 NULL)
ON CONFLICT (key) DO NOTHING;
