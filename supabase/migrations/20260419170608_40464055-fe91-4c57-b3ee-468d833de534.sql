ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS office_parts numeric DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS total_marketer numeric DEFAULT 0;