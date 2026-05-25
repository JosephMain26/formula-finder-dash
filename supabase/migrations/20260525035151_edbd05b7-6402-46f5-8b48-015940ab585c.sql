
-- Installation catalog
CREATE TABLE public.install_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.install_sub_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.install_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_install_sub_items_group ON public.install_sub_items(group_id);

CREATE TABLE public.install_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.install_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  colors TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_install_models_group ON public.install_models(group_id);

CREATE TABLE public.job_installations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  group_id UUID REFERENCES public.install_groups(id) ON DELETE SET NULL,
  group_name TEXT,
  model_id UUID REFERENCES public.install_models(id) ON DELETE SET NULL,
  model_name TEXT,
  color TEXT,
  notes TEXT,
  sub_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_installations_job ON public.job_installations(job_id);

ALTER TABLE public.install_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.install_sub_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.install_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_installations ENABLE ROW LEVEL SECURITY;

-- Catalog: authenticated read, admin/manager manage
CREATE POLICY "Auth view install_groups" ON public.install_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage install_groups" ON public.install_groups FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "Auth view install_sub_items" ON public.install_sub_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage install_sub_items" ON public.install_sub_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "Auth view install_models" ON public.install_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage install_models" ON public.install_models FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

-- Job installations: authenticated read/write (mirror jobs)
CREATE POLICY "Auth view job_installations" ON public.job_installations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert job_installations" ON public.job_installations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update job_installations" ON public.job_installations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete job_installations" ON public.job_installations FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_install_groups_updated BEFORE UPDATE ON public.install_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_job_installations_updated BEFORE UPDATE ON public.job_installations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
