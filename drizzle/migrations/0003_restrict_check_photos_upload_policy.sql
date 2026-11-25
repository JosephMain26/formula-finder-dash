DROP POLICY IF EXISTS "Auth upload check photos" ON storage.objects;

CREATE POLICY "Staff upload own check photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'check-photos'
    AND owner_id = (SELECT auth.uid()::text)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'tech'::public.app_role)
    )
  );