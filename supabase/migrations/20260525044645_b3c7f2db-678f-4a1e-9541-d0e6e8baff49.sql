
CREATE TABLE IF NOT EXISTS public.install_colors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.install_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view install_colors" ON public.install_colors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage install_colors" ON public.install_colors FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TABLE IF NOT EXISTS public.install_sizes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  width text NOT NULL,
  height text NOT NULL,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.install_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view install_sizes" ON public.install_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage install_sizes" ON public.install_sizes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

ALTER TABLE public.job_installations
  ADD COLUMN IF NOT EXISTS system_type text,
  ADD COLUMN IF NOT EXISTS size_id uuid,
  ADD COLUMN IF NOT EXISTS size_label text;

INSERT INTO public.install_colors (name)
SELECT DISTINCT trim(c) FROM public.install_models, unnest(colors) AS c
WHERE trim(c) <> ''
ON CONFLICT (name) DO NOTHING;
