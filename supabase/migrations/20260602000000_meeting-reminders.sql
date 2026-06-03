-- Pre-meeting dinner reminders: add reminded_at to sign_ups and
-- reminder_days_before to email_templates (only used by dinner_reminder).

ALTER TABLE public.sign_ups
  ADD COLUMN reminded_at TIMESTAMPTZ;

CREATE INDEX sign_ups_reminder_idx
  ON public.sign_ups(reminded_at)
  WHERE cancelled_at IS NULL AND reminded_at IS NULL;

ALTER TABLE public.email_templates
  ADD COLUMN reminder_days_before SMALLINT;

UPDATE public.email_templates
  SET reminder_days_before = 3
  WHERE key = 'dinner_reminder';
