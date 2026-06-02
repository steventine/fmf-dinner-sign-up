-- Email campaign manager: add template_type, audience_type, schedule fields,
-- email_send_log table, and app_url to settings.

ALTER TABLE public.email_templates
  ADD COLUMN template_type TEXT NOT NULL DEFAULT 'one_off',
  ADD COLUMN audience_type TEXT,
  ADD COLUMN schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN schedule_cron TEXT,
  ADD COLUMN schedule_next_run_at TIMESTAMPTZ,
  ADD COLUMN schedule_last_run_at TIMESTAMPTZ;

UPDATE public.email_templates
  SET template_type = 'transactional'
  WHERE key IN ('parent_link', 'dinner_reminder');

CREATE TABLE public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL REFERENCES public.email_templates(key) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT
);

CREATE INDEX email_send_log_template_idx ON public.email_send_log(template_key, sent_at DESC);
CREATE INDEX email_send_log_parent_idx ON public.email_send_log(parent_id);

GRANT SELECT, INSERT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read send log"
  ON public.email_send_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.settings
  ADD COLUMN app_url TEXT NOT NULL DEFAULT '';
