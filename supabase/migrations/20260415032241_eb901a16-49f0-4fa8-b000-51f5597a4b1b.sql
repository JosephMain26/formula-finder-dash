
CREATE TABLE public.job_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view job_types" ON public.job_types FOR SELECT USING (true);
CREATE POLICY "Anyone can create job_types" ON public.job_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update job_types" ON public.job_types FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete job_types" ON public.job_types FOR DELETE USING (true);
