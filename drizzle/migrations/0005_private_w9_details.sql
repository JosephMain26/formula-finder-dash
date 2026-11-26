CREATE TABLE public.w9_details (
 entity_type text NOT NULL CHECK (entity_type IN ('company','installer','technician')),
 entity_id uuid NOT NULL,
 business_name text NOT NULL DEFAULT '',
 address text NOT NULL DEFAULT '',
 city text NOT NULL DEFAULT '',
 state text NOT NULL DEFAULT '',
 zip text NOT NULL DEFAULT '',
 tax_id_type text NOT NULL DEFAULT '' CHECK (tax_id_type IN ('','SSN','EIN')),
 tax_id text NOT NULL DEFAULT '' CHECK (tax_id = '' OR tax_id ~ '^[0-9]{9}$'),
 PRIMARY KEY (entity_type, entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.w9_details TO authenticated;
GRANT ALL ON public.w9_details TO service_role;
ALTER TABLE public.w9_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins managers manage private W9 details" ON public.w9_details FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));