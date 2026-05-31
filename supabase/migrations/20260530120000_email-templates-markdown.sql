-- Replace html_body with markdown_body on email_templates.
-- Templates are now authored in Markdown; the server converts to HTML before sending.

ALTER TABLE public.email_templates
  ADD COLUMN markdown_body TEXT NOT NULL DEFAULT '';

ALTER TABLE public.email_templates
  DROP COLUMN html_body;

-- Seed Markdown bodies for the two built-in templates.
UPDATE public.email_templates
SET markdown_body = 'Hi {{parent_name}},

Here is your personal link to sign up for Full-Metal Falcons team dinners:

[Open my dinner page]({{link_url}})

Or copy this URL: {{link_url}}

*Keep this link private — anyone with it can manage your sign-ups.*'
WHERE key = 'parent_link';

UPDATE public.email_templates
SET markdown_body = '## Dinner reminder

Hi {{parent_name}},

This is a friendly reminder that you''re signed up to bring **{{dinner}}** for {{student_name}}''s meeting on **{{meeting_date}}**.

[View your dinner sign-ups]({{link_url}})

Thanks for supporting the Falcons!'
WHERE key = 'dinner_reminder';
