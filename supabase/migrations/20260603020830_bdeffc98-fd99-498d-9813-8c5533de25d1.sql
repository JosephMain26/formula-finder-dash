CREATE POLICY "Auth view check photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'check-photos');
CREATE POLICY "Auth upload check photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'check-photos');
CREATE POLICY "Auth update check photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'check-photos');
CREATE POLICY "Auth delete check photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'check-photos');