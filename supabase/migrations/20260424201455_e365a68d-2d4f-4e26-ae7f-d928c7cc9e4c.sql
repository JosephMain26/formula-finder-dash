-- Create marketer_types table
CREATE TABLE public.marketer_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketer_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view marketer_types"
  ON public.marketer_types FOR SELECT
  USING (true);

CREATE POLICY "Authenticated manage marketer_types"
  ON public.marketer_types FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Convert companies.company_type from text to text[], preserving existing values
ALTER TABLE public.companies
  ALTER COLUMN company_type DROP DEFAULT;

ALTER TABLE public.companies
  ALTER COLUMN company_type TYPE text[]
  USING CASE
    WHEN company_type IS NULL OR company_type = '' THEN '{}'::text[]
    ELSE string_to_array(company_type, ',')
  END;

ALTER TABLE public.companies
  ALTER COLUMN company_type SET DEFAULT '{}'::text[];

-- Seed marketer_types with existing distinct values from companies
INSERT INTO public.marketer_types (name)
SELECT DISTINCT trim(unnest(company_type))
FROM public.companies
WHERE company_type IS NOT NULL AND array_length(company_type, 1) > 0
ON CONFLICT (name) DO NOTHING;