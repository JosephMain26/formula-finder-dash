
-- Drop and recreate generated columns with updated formulas
-- total_tech = (price - co_parts) * (percentage/100) + parts + tip
-- total_office = (price - co_parts) * ((100-percentage)/100) + co_parts - cc_fee

ALTER TABLE public.jobs DROP COLUMN total_tech;
ALTER TABLE public.jobs DROP COLUMN total_office;

ALTER TABLE public.jobs ADD COLUMN total_tech numeric GENERATED ALWAYS AS (
  round(((price - co_parts) * (manual_percentage / 100.0)) + parts + tip, 2)
) STORED;

ALTER TABLE public.jobs ADD COLUMN total_office numeric GENERATED ALWAYS AS (
  round(((price - co_parts) - ((price - co_parts) * (manual_percentage / 100.0))) + co_parts - cc_fee, 2)
) STORED;
