INSERT INTO public.email_templates (key, name, description, subject, html_body, available_variables)
VALUES (
  'dinner_reminder',
  'Dinner reminder',
  'Sent to a parent before a meeting where they have signed up to bring a dinner item.',
  'Reminder: dinner for {{meeting_date}}',
  '<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
    <h2 style="margin: 0 0 16px;">Dinner reminder</h2>
    <p>Hi {{parent_name}},</p>
    <p>This is a friendly reminder that you''re signed up to bring <strong>{{dinner}}</strong> for {{student_name}}''s meeting on <strong>{{meeting_date}}</strong>.</p>
    <p>You can view or update your sign-up here:</p>
    <p><a href="{{link_url}}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">View your dinner sign-ups</a></p>
    <p style="color:#666;font-size:13px;margin-top:24px;">Thanks for supporting the Falcons!</p>
  </body>
</html>',
  ARRAY['parent_name', 'student_name', 'meeting_date', 'dinner', 'link_url']
)
ON CONFLICT (key) DO NOTHING;