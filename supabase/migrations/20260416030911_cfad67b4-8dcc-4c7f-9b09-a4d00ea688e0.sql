
ALTER TABLE public.jobs DROP COLUMN total_tech;
ALTER TABLE public.jobs DROP COLUMN total_office;
ALTER TABLE public.jobs ADD COLUMN total_tech numeric DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN total_office numeric DEFAULT 0;
