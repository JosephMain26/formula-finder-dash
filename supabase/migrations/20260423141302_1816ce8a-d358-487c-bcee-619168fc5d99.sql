-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage permissions"
  ON public.permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.permissions (key, label) VALUES
  ('jobs.view',        'View jobs'),
  ('jobs.add',         'Add jobs'),
  ('jobs.edit',        'Edit jobs'),
  ('jobs.delete',      'Delete jobs'),
  ('entities.manage',  'Manage marketers/techs'),
  ('ai.view',          'View AI training'),
  ('users.manage',     'Manage users & roles'),
  ('upload.remote',    'Use remote upload link');

-- ============================================================
-- CUSTOM ROLES (for roles beyond admin/manager/user)
-- ============================================================
CREATE TABLE public.custom_roles (
  name text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view custom roles"
  ON public.custom_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage custom roles"
  ON public.custom_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- ROLE -> PERMISSIONS MAPPING
-- role_name is text so it can reference both built-in and custom roles
-- ============================================================
CREATE TABLE public.role_permissions (
  role_name text NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_name, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default grants (admin gets everything implicitly via has_permission, but seed for matrix display)
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key FROM public.permissions;

INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('manager', 'jobs.view'),
  ('manager', 'jobs.add'),
  ('manager', 'jobs.edit'),
  ('manager', 'jobs.delete'),
  ('manager', 'upload.remote'),
  ('user',    'jobs.view'),
  ('user',    'jobs.add'),
  ('user',    'upload.remote');

-- ============================================================
-- PENDING INVITES
-- ============================================================
CREATE TABLE public.pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL,
  invited_by uuid,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pending_invites_email_open_idx
  ON public.pending_invites (lower(email))
  WHERE accepted_at IS NULL;

ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invites"
  ON public.pending_invites FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- has_permission helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin short-circuit
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'admin'::app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp
        ON rp.role_name = ur.role::text
      WHERE ur.user_id = _user_id
        AND rp.permission_key = _key
    );
$$;

-- ============================================================
-- Update handle_new_user trigger to honor pending invites
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_seeded_admin BOOLEAN;
  invite_role TEXT;
  invite_id UUID;
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
    RETURN NEW;
  END IF;

  -- Look up open invite by email
  SELECT id, role INTO invite_id, invite_role
  FROM public.pending_invites
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_role IS NOT NULL THEN
    -- Only assign if it's a valid app_role enum value; otherwise default to 'user'
    BEGIN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, invite_role::app_role);
    EXCEPTION WHEN invalid_text_representation OR others THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
    END;

    UPDATE public.pending_invites SET accepted_at = now() WHERE id = invite_id;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$function$;