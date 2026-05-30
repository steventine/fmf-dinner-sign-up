
-- Block signups for emails not in the allowlist
CREATE OR REPLACE FUNCTION public.enforce_admin_signup_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'Email required for sign-up';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_email_allowlist
    WHERE email = NEW.email::citext
  ) THEN
    RAISE EXCEPTION 'This email is not invited. Ask an existing admin to invite you.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_admin_signup_allowlist ON auth.users;
CREATE TRIGGER enforce_admin_signup_allowlist
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_admin_signup_allowlist();

-- Make sure the existing AFTER INSERT trigger that grants admin role is attached
DROP TRIGGER IF EXISTS handle_new_admin_user ON auth.users;
CREATE TRIGGER handle_new_admin_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_admin_user();

-- Admins can manage the allowlist
DROP POLICY IF EXISTS "Admins manage allowlist" ON public.admin_email_allowlist;
CREATE POLICY "Admins manage allowlist"
ON public.admin_email_allowlist
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
