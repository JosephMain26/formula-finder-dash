ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS notify_lead_minutes_list integer[] NOT NULL DEFAULT '{60}',
  ADD COLUMN IF NOT EXISTS notified_lead_minutes integer[] NOT NULL DEFAULT '{}';

UPDATE public.jobs
  SET notify_lead_minutes_list = ARRAY[notify_lead_minutes]
  WHERE notify_lead_minutes IS NOT NULL
    AND (notify_lead_minutes_list IS NULL OR notify_lead_minutes_list = '{60}'::integer[]);