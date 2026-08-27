-- Move the "what to bring" guidance out of the page source and into settings, so
-- the meeting time and suggested vendors can change without a deploy.
-- The long form heads the Dinner ideas tab and the public page; the short form is
-- the one-line reminder on a parent's own dinners tab.

ALTER TABLE public.settings
  ADD COLUMN dinner_guidance TEXT NOT NULL DEFAULT '',
  ADD COLUMN dinner_guidance_short TEXT NOT NULL DEFAULT '';

-- Seeded with the copy that was hard-coded on the public page, so nothing changes
-- visually until an admin edits it.
UPDATE public.settings
SET
  dinner_guidance = 'Please bring your dinner to Xavier at 6pm. Dinner should include a main entree; a side or dessert is nice but optional. Some possible main entrees include Illiano''s pizza, Big Y sandwiches or pizza, and homemade dishes (grilled chicken, pasta, hot dogs, tacos, BBQ). You should ask your student to check Slack to see how many people have signed up for the meeting, and it is suggested that you bring a little extra as there will be people who forget to sign up.',
  dinner_guidance_short = 'Dinner comes to Xavier at 6pm and should include a main entree. Ask your student for the Slack headcount, and bring a little extra for the people who forget to sign up.'
WHERE id = 1;
