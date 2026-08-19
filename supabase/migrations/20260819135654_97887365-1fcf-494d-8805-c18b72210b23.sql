CREATE POLICY "Authenticated can view expense files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'expense-files');
CREATE POLICY "Authenticated can upload expense files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'expense-files');
CREATE POLICY "Authenticated can update expense files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'expense-files');
CREATE POLICY "Authenticated can delete expense files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'expense-files');