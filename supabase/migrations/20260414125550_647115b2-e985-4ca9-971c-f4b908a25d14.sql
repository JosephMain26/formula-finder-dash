
-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  company_type TEXT,
  percentage NUMERIC(5,2) DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Anyone can create companies" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update companies" ON public.companies FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete companies" ON public.companies FOR DELETE USING (true);

-- Timestamp trigger
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add company_id foreign key to jobs
ALTER TABLE public.jobs
  ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
