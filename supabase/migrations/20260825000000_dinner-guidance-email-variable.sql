-- The short guidance moves off the website and becomes an email variable, so the
-- reminder can carry the must-knows (time, entree, bring extra) to parents who
-- never open the app. The settings column stays — it is now the variable's source.

UPDATE public.email_templates
SET available_variables = array_append(available_variables, 'dinner_guidance')
WHERE key = 'dinner_reminder'
  AND NOT ('dinner_guidance' = ANY (available_variables));
