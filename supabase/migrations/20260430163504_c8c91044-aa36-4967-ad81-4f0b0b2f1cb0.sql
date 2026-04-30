CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX clients_phone_unique ON public.clients (lower(phone)) WHERE phone IS NOT NULL AND phone <> '';

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_id UUID;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert clients"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Edit clients with permission"
  ON public.clients FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_permission(auth.uid(), 'clients.edit')
  );

CREATE POLICY "Delete clients with permission"
  ON public.clients FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'clients.delete')
  );

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.permissions (key, label, description) VALUES
  ('clients.edit', 'Edit clients', 'Allow editing client records'),
  ('clients.delete', 'Delete clients', 'Allow deleting client records')
ON CONFLICT (key) DO NOTHING;