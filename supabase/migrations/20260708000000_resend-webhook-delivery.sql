-- Delivery tracking via Resend webhooks: store Resend's email id on each send-log
-- row so webhook events (delivered/bounced/complained/delayed) can update it.
ALTER TABLE public.email_send_log
  ADD COLUMN resend_email_id TEXT,
  ADD COLUMN delivery_status TEXT,
  ADD COLUMN delivery_detail TEXT,
  ADD COLUMN delivery_updated_at TIMESTAMPTZ;

CREATE INDEX email_send_log_resend_id_idx
  ON public.email_send_log(resend_email_id)
  WHERE resend_email_id IS NOT NULL;
