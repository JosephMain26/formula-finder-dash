CREATE TABLE public.parts_charges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marketer text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  charge_date date,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_charges TO authenticated;
GRANT ALL ON public.parts_charges TO service_role;

ALTER TABLE public.parts_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view parts_charges"
  ON public.parts_charges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated create parts_charges"
  ON public.parts_charges FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins and managers update parts_charges"
  ON public.parts_charges FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers delete parts_charges"
  ON public.parts_charges FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_parts_charges_updated_at
  BEFORE UPDATE ON public.parts_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();