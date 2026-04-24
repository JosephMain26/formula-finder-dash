-- Link technicians to users + add 6-digit pincode for remote upload
ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pincode text NULL;

ALTER TABLE public.technicians
  DROP CONSTRAINT IF EXISTS technicians_pincode_format;
ALTER TABLE public.technicians
  ADD CONSTRAINT technicians_pincode_format
  CHECK (pincode IS NULL OR pincode ~ '^[0-9]{6}$');

CREATE UNIQUE INDEX IF NOT EXISTS technicians_pincode_unique
  ON public.technicians (pincode) WHERE pincode IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS technicians_user_id_unique
  ON public.technicians (user_id) WHERE user_id IS NOT NULL;

-- Lookup function used by the unauthenticated /upload page.
CREATE OR REPLACE FUNCTION public.lookup_tech_by_pincode(_pin text)
RETURNS TABLE(id uuid, tech_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, tech_name
  FROM public.technicians
  WHERE pincode = _pin
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_tech_by_pincode(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_tech_by_pincode(text) TO anon, authenticated;