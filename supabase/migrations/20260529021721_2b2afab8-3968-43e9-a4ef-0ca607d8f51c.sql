CREATE TABLE public.report_automations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  template jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipients jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_automations TO authenticated;
GRANT ALL ON public.report_automations TO service_role;

ALTER TABLE public.report_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers view automations"
ON public.report_automations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers create automations"
ON public.report_automations
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers update automations"
ON public.report_automations
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers delete automations"
ON public.report_automations
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_report_automations_updated_at
BEFORE UPDATE ON public.report_automations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();