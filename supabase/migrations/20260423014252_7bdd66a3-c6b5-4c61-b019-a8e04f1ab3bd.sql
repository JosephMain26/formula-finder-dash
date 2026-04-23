-- Create installers table
CREATE TABLE public.installers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT,
  email TEXT,
  install_types TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.installers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view installers" ON public.installers FOR SELECT USING (true);
CREATE POLICY "Anyone can create installers" ON public.installers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update installers" ON public.installers FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete installers" ON public.installers FOR DELETE USING (true);

CREATE TRIGGER update_installers_updated_at
BEFORE UPDATE ON public.installers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Link jobs to installers (optional)
ALTER TABLE public.jobs
  ADD COLUMN installer_id UUID REFERENCES public.installers(id) ON DELETE SET NULL,
  ADD COLUMN installer_name TEXT;