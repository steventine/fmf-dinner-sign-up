-- Add banquet_time, banquet_location, and banquet_notes to the banquet email templates'
-- advertised variable lists.

UPDATE public.email_templates
  SET available_variables = ARRAY['parent_name','banquet_date','banquet_time','banquet_location','banquet_notes','link_url']
  WHERE key = 'banquet_invitation';

UPDATE public.email_templates
  SET available_variables = ARRAY['parent_name','banquet_date','banquet_time','banquet_location','banquet_notes','guest_count','items','link_url']
  WHERE key = 'banquet_reminder';
