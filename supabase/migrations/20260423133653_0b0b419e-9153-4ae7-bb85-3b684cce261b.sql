-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Admin seed table
CREATE TABLE public.admin_seed (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_seed ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_seed (email) VALUES ('maintenanceal24@gmail.com');

-- 5. Security definer function for role checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 6. Helper: any authenticated role
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- 7. Trigger: on signup, create profile + assign role (admin if seeded, else 'user')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_seeded_admin BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );

  SELECT EXISTS (SELECT 1 FROM public.admin_seed WHERE lower(email) = lower(NEW.email))
  INTO is_seeded_admin;

  IF is_seeded_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Profiles RLS
CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9. User roles RLS
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 10. Admin seed RLS (admins only)
CREATE POLICY "Admins manage seed"
  ON public.admin_seed FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 11. Replace old open RLS on jobs
DROP POLICY IF EXISTS "Anyone can view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Anyone can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Anyone can update jobs" ON public.jobs;
DROP POLICY IF EXISTS "Anyone can delete jobs" ON public.jobs;

CREATE POLICY "Authenticated view jobs"
  ON public.jobs FOR SELECT TO authenticated USING (true);
-- Public INSERT for the remote upload link
CREATE POLICY "Anyone can create jobs"
  ON public.jobs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Managers and admins update jobs"
  ON public.jobs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR auth.uid() IS NOT NULL);
CREATE POLICY "Admins and managers delete jobs"
  ON public.jobs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 12. Companies
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can create companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can update companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can delete companies" ON public.companies;

CREATE POLICY "Public view companies" ON public.companies FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update companies" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins delete companies" ON public.companies FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 13. Technicians
DROP POLICY IF EXISTS "Anyone can view technicians" ON public.technicians;
DROP POLICY IF EXISTS "Anyone can create technicians" ON public.technicians;
DROP POLICY IF EXISTS "Anyone can update technicians" ON public.technicians;
DROP POLICY IF EXISTS "Anyone can delete technicians" ON public.technicians;

CREATE POLICY "Public view technicians" ON public.technicians FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated create technicians" ON public.technicians FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update technicians" ON public.technicians FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins delete technicians" ON public.technicians FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 14. Installers
DROP POLICY IF EXISTS "Anyone can view installers" ON public.installers;
DROP POLICY IF EXISTS "Anyone can create installers" ON public.installers;
DROP POLICY IF EXISTS "Anyone can update installers" ON public.installers;
DROP POLICY IF EXISTS "Anyone can delete installers" ON public.installers;

CREATE POLICY "Public view installers" ON public.installers FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated create installers" ON public.installers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update installers" ON public.installers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins delete installers" ON public.installers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 15. Job types
DROP POLICY IF EXISTS "Anyone can view job_types" ON public.job_types;
DROP POLICY IF EXISTS "Anyone can create job_types" ON public.job_types;
DROP POLICY IF EXISTS "Anyone can update job_types" ON public.job_types;
DROP POLICY IF EXISTS "Anyone can delete job_types" ON public.job_types;

CREATE POLICY "Public view job_types" ON public.job_types FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated create job_types" ON public.job_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update job_types" ON public.job_types FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins delete job_types" ON public.job_types FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 16. App settings — admin only writes, public read (so /upload form can fetch settings)
DROP POLICY IF EXISTS "Anyone can view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can delete settings" ON public.app_settings;

CREATE POLICY "Public view settings" ON public.app_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admins insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete settings" ON public.app_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 17. Trigger to keep profiles.updated_at fresh
CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();