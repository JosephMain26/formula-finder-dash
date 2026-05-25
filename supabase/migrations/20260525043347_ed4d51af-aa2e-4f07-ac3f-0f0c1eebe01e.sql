ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deposit_payment_method text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deposit_check_no text;