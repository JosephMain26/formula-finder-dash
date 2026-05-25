CREATE TABLE public.door_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  contact_name text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.door_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view door_centers" ON public.door_centers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage door_centers" ON public.door_centers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_door_centers_updated_at
  BEFORE UPDATE ON public.door_centers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.jobs ADD COLUMN pickup_door_center_id uuid;