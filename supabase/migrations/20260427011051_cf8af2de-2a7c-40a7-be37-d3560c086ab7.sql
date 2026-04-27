-- 1. New permission: jobs.view_all
INSERT INTO public.permissions (key, label, description)
VALUES ('jobs.view_all', 'View all users'' jobs', 'When OFF, the user can only see jobs assigned to themselves (matched by their linked technician name).')
ON CONFLICT (key) DO NOTHING;

-- 2. Seed it for admin and manager (admin already gets all perms via has_role short-circuit, but explicit row is fine)
INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('admin', 'jobs.view_all'), ('manager', 'jobs.view_all')
ON CONFLICT DO NOTHING;

-- 3. Remove the buggy default that gave every 'user' role full DataBoard visibility
DELETE FROM public.role_permissions
WHERE role_name = 'user' AND permission_key = 'databoard.view_all';

-- 4. Default global setting: do NOT share data across users
INSERT INTO public.app_settings (key, value)
VALUES ('data_visibility', '{"shareAcrossUsers": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Effective-permission helper: can the user see everyone's jobs?
CREATE OR REPLACE FUNCTION public.can_view_all_jobs(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin always sees everything
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::app_role)
    OR
    -- Global toggle ON
    COALESCE((SELECT (value->>'shareAcrossUsers')::boolean FROM public.app_settings WHERE key = 'data_visibility'), false)
    OR
    -- Per-role override (jobs.view_all OR legacy databoard.view_all)
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_name = ur.role::text
      WHERE ur.user_id = _user_id
        AND rp.permission_key IN ('jobs.view_all', 'databoard.view_all')
    );
$$;

-- 6. Helper: tech_name linked to the calling user (NULL if none)
CREATE OR REPLACE FUNCTION public.current_user_tech_name()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tech_name FROM public.technicians WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 7. Replace the permissive jobs SELECT policy with a scoped one
DROP POLICY IF EXISTS "Authenticated view jobs" ON public.jobs;

CREATE POLICY "View own or all jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  public.can_view_all_jobs(auth.uid())
  OR tech_name = public.current_user_tech_name()
);