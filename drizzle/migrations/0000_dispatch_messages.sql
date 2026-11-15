CREATE TABLE public.dispatch_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  contact_name text,
  contact_type text NOT NULL DEFAULT 'other',
  direction text NOT NULL DEFAULT 'out',
  channel text NOT NULL DEFAULT 'sms',
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  job_id uuid,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispatch_messages_phone_idx ON public.dispatch_messages(phone, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_messages TO authenticated;
GRANT ALL ON public.dispatch_messages TO service_role;
ALTER TABLE public.dispatch_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff all dispatch" ON public.dispatch_messages FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));