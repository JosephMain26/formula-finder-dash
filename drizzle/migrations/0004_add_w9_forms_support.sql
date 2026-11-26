ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS w9_path TEXT;
ALTER TABLE public.installers ADD COLUMN IF NOT EXISTS w9_path TEXT;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS w9_path TEXT;

CREATE POLICY "Admins and managers view w9 forms"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'w9-forms'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Admins and managers upload own w9 forms"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'w9-forms'
  AND owner_id = auth.uid()::text
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Admins and managers update w9 forms"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'w9-forms'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Admins and managers delete w9 forms"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'w9-forms'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);