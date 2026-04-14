
-- Create jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_date DATE,
  company_1 TEXT,
  tech_name TEXT,
  po_number TEXT,
  phone_no TEXT,
  address TEXT,
  comp_type TEXT,
  job_type TEXT,
  status TEXT DEFAULT 'Pending',
  price NUMERIC(10,2) DEFAULT 0,
  co_parts NUMERIC(10,2) DEFAULT 0,
  parts NUMERIC(10,2) DEFAULT 0,
  payment TEXT,
  check_no TEXT,
  tip NUMERIC(10,2) DEFAULT 0,
  cost NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  cc_fee NUMERIC(10,2) DEFAULT 0,
  manual_percentage NUMERIC(5,2) DEFAULT 50,
  created_by TEXT,
  paid BOOLEAN DEFAULT false,
  company TEXT,
  maps TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Computed columns (formulas)
  total_tech NUMERIC(10,2) GENERATED ALWAYS AS (
    ROUND(((price - co_parts) * (manual_percentage / 100)) + tip, 2)
  ) STORED,
  total_office NUMERIC(10,2) GENERATED ALWAYS AS (
    ROUND(price - co_parts - (((price - co_parts) * (manual_percentage / 100)) + tip), 2)
  ) STORED
);

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required)
CREATE POLICY "Anyone can view jobs" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Anyone can create jobs" ON public.jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update jobs" ON public.jobs FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete jobs" ON public.jobs FOR DELETE USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
