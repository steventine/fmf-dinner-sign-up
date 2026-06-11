-- End-of-year banquet: RSVPs with guest counts and potluck item sign-ups,
-- capacity-enforced item claims, plus banquet email templates.

CREATE TABLE public.banquets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_year INT NOT NULL UNIQUE,
  date DATE NOT NULL,
  time TEXT,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.banquet_item_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banquet_id UUID NOT NULL REFERENCES public.banquets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  capacity INT NOT NULL CHECK (capacity >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (banquet_id, name)
);
CREATE INDEX banquet_item_categories_banquet_idx ON public.banquet_item_categories(banquet_id);

CREATE TABLE public.banquet_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banquet_id UUID NOT NULL REFERENCES public.banquets(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  attending BOOLEAN NOT NULL,
  guest_count INT NOT NULL DEFAULT 0 CHECK (guest_count >= 0 AND guest_count <= 30),
  reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (banquet_id, student_id)
);
CREATE INDEX banquet_rsvps_banquet_idx ON public.banquet_rsvps(banquet_id);

CREATE TABLE public.banquet_item_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.banquet_item_categories(id) ON DELETE CASCADE,
  rsvp_id UUID NOT NULL REFERENCES public.banquet_rsvps(id) ON DELETE CASCADE,
  item_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX banquet_item_signups_category_idx ON public.banquet_item_signups(category_id);
CREATE INDEX banquet_item_signups_rsvp_idx ON public.banquet_item_signups(rsvp_id);

-- Race-free capacity enforcement: lock the category row, count, then insert.
CREATE OR REPLACE FUNCTION public.claim_banquet_item(
  _category_id UUID,
  _rsvp_id UUID,
  _item_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cap INT;
  _count INT;
  _id UUID;
BEGIN
  SELECT capacity INTO _cap FROM public.banquet_item_categories WHERE id = _category_id FOR UPDATE;
  IF _cap IS NULL THEN
    RAISE EXCEPTION 'CATEGORY_NOT_FOUND';
  END IF;
  SELECT count(*) INTO _count FROM public.banquet_item_signups WHERE category_id = _category_id;
  IF _count >= _cap THEN
    RAISE EXCEPTION 'CATEGORY_FULL';
  END IF;
  INSERT INTO public.banquet_item_signups (category_id, rsvp_id, item_description)
    VALUES (_category_id, _rsvp_id, _item_description)
    RETURNING id INTO _id;
  RETURN _id;
END
$$;

REVOKE EXECUTE ON FUNCTION public.claim_banquet_item(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- RLS
ALTER TABLE public.banquets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banquet_item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banquet_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banquet_item_signups ENABLE ROW LEVEL SECURITY;

-- Public read: the calendar shows banquet info and claimed-vs-needed counts.
CREATE POLICY "Anyone can view banquets" ON public.banquets FOR SELECT USING (true);
CREATE POLICY "Anyone can view banquet categories" ON public.banquet_item_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can view banquet item signups" ON public.banquet_item_signups FOR SELECT USING (true);

-- RSVPs (guest counts per household) are admin-only; parents go through server fns.
CREATE POLICY "Admins manage banquets" ON public.banquets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage banquet categories" ON public.banquet_item_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage banquet rsvps" ON public.banquet_rsvps FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage banquet item signups" ON public.banquet_item_signups FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Email templates
INSERT INTO public.email_templates
  (key, name, description, subject, markdown_body, available_variables, template_type, reminder_days_before)
VALUES
('banquet_invitation',
 'Banquet invitation',
 'Invites households to RSVP for the end-of-year banquet. Sent from the admin Banquet page.',
 'You''re invited: FullMetal Falcons end-of-year banquet',
 'Hi {{parent_name}},

You''re invited to the FullMetal Falcons end-of-year banquet on **{{banquet_date}}**!

It''s potluck style — please RSVP and pick what you''d like to bring:

[RSVP for the banquet]({{link_url}})

We hope to see you there!',
 ARRAY['parent_name','banquet_date','link_url'],
 'transactional',
 NULL),
('banquet_reminder',
 'Banquet reminder',
 'Reminds attending households what they signed up to bring, a configurable number of days before the banquet.',
 'Banquet reminder: what you''re bringing',
 '## Banquet reminder

Hi {{parent_name}},

The FullMetal Falcons banquet is on **{{banquet_date}}** — you RSVPed with **{{guest_count}}** guest(s).

You signed up to bring:

{{items}}

[View or update your RSVP]({{link_url}})

Thanks for supporting the FullMetal Falcons!',
 ARRAY['parent_name','banquet_date','guest_count','items','link_url'],
 'transactional',
 3);
