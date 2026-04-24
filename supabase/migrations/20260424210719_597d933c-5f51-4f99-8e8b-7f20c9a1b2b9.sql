ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS mobile_phone text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.profiles
SET
  first_name = COALESCE(first_name, NULLIF(split_part(coalesce(display_name, ''), ' ', 1), '')),
  last_name = COALESCE(
    last_name,
    NULLIF(
      btrim(substring(coalesce(display_name, '') from position(' ' in coalesce(display_name, '') || ' ') + 1)),
      ''
    )
  )
WHERE display_name IS NOT NULL
  AND (first_name IS NULL OR last_name IS NULL);