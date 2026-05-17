
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_time time,
  ADD COLUMN IF NOT EXISTS notify_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_channels text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS notify_lead_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_log_job_id_idx ON public.notification_log(job_id);
CREATE INDEX IF NOT EXISTS notification_log_sent_at_idx ON public.notification_log(sent_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view notification_log"
ON public.notification_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role insert notification_log"
ON public.notification_log FOR INSERT TO public
WITH CHECK (auth.role() = 'service_role');
