CREATE TABLE public.email_templates (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  available_variables TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT, UPDATE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email templates"
  ON public.email_templates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update email templates"
  ON public.email_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.email_templates (key, name, description, subject, html_body, available_variables) VALUES
('parent_link',
 'Parent sign-in link',
 'Sent when a parent requests their magic-link from the public Sign in dialog.',
 'Your Full-Metal Falcons dinner sign-up link',
 '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
  <h2 style="color:#111;">Hi {{parent_name}},</h2>
  <p>Here is your personal link to sign up for Full-Metal Falcons team dinners:</p>
  <p><a href="{{link_url}}" style="background:#1e3a8a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Open my dinner page</a></p>
  <p style="color:#555;font-size:13px;">Or copy this URL: <br/><span style="word-break:break-all;">{{link_url}}</span></p>
  <p style="color:#888;font-size:12px;margin-top:32px;">Keep this link private — anyone with it can manage your sign-ups.</p>
</div>',
 ARRAY['parent_name','link_url']);
