
-- Make the view run with the querying user's permissions, not creator's
ALTER VIEW public.v_meeting_status SET (security_invoker = true);

-- Revoke direct execute on security-definer helpers from public roles.
-- Server functions use the service-role key which bypasses these grants.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.household_progress(UUID, INT) FROM PUBLIC, anon, authenticated;

-- has_role is referenced inside RLS policies; those evaluate as the function owner
-- so explicit EXECUTE grants are not needed. household_progress is only ever called
-- by server functions via the service-role admin client.
