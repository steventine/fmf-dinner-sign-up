CREATE TABLE public.admin_email_allowlist (
  email citext PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_email_allowlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view allowlist" ON public.admin_email_allowlist FOR SELECT USING (has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_email_allowlist (email) VALUES ('steve@tinefamily.com');

CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_email_allowlist WHERE email = NEW.email::citext) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_user();

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role);