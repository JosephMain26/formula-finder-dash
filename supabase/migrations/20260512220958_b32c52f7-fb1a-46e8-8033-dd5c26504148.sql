ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS tech_pay_mode text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS tech_fixed_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_tech_pay_mode_check CHECK (tech_pay_mode IN ('percent','fixed'));