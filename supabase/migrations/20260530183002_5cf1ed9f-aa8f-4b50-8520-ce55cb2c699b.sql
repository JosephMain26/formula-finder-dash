-- 1. Restrict anonymous column access on technicians (hide pincode, phone, percentage, city)
REVOKE SELECT ON public.technicians FROM anon;
GRANT SELECT (id, tech_name) ON public.technicians TO anon;

-- 2. Restrict anonymous column access on companies (hide email, percentage)
REVOKE SELECT ON public.companies FROM anon;
GRANT SELECT (id, company_name) ON public.companies TO anon;

-- 3. Restrict anonymous column access on installers (hide phone_number, email)
REVOKE SELECT ON public.installers FROM anon;
GRANT SELECT (id, name) ON public.installers TO anon;

-- 4. Companies UPDATE -> admins/managers only
DROP POLICY IF EXISTS "Authenticated update companies" ON public.companies;
CREATE POLICY "Admins and managers update companies"
  ON public.companies FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 5. Technicians UPDATE -> self or admins/managers
DROP POLICY IF EXISTS "Authenticated update technicians" ON public.technicians;
CREATE POLICY "Technicians update own or staff"
  ON public.technicians FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 6. Installers UPDATE -> admins/managers only
DROP POLICY IF EXISTS "Authenticated update installers" ON public.installers;
CREATE POLICY "Admins and managers update installers"
  ON public.installers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 7. Jobs UPDATE -> remove blanket "any authenticated" access; keep role + ownership
DROP POLICY IF EXISTS "Managers and admins update jobs" ON public.jobs;
CREATE POLICY "Managers and admins update jobs"
  ON public.jobs FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (tech_name = current_user_tech_name())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (tech_name = current_user_tech_name())
  );

-- 8. Set immutable search_path on functions missing it
ALTER FUNCTION public.is_authenticated() SET search_path TO 'public';
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path TO 'public';
ALTER FUNCTION public.delete_email(text, bigint) SET search_path TO 'public';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path TO 'public';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path TO 'public';