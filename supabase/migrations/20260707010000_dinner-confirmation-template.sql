-- Instant confirmation email sent right after a parent signs up for a dinner.
INSERT INTO public.email_templates
  (key, name, description, subject, markdown_body, available_variables, template_type)
VALUES
('dinner_confirmation',
 'Dinner sign-up confirmation',
 'Sent to a parent immediately after they sign up to bring dinner for a meeting.',
 'You''re signed up: dinner on {{meeting_date}}',
 'Hi {{parent_name}},

You''re confirmed to bring **{{dinner}}** for {{student_name}}''s meeting on **{{meeting_date}}**.

Need to make a change? You can update or cancel your sign-up any time:

[View your dinner sign-ups]({{link_url}})

Thanks for supporting the FullMetal Falcons!',
 ARRAY['parent_name','student_name','meeting_date','dinner','link_url'],
 'transactional')
ON CONFLICT (key) DO NOTHING;
