ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS marketer_pay_mode text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS marketer_fixed_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS office_pay_mode text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS office_fixed_amount numeric NOT NULL DEFAULT 0;