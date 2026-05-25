
-- Deposit + completion fields on jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS deposit_received boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_date date,
  ADD COLUMN IF NOT EXISTS scheduled_completion_date date,
  ADD COLUMN IF NOT EXISTS completed_at_date date;

-- Message templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('technician','marketer','installer','client','custom')),
  channel_default text NOT NULL DEFAULT 'whatsapp' CHECK (channel_default IN ('whatsapp','sms')),
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view templates"
  ON public.message_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/managers manage templates"
  ON public.message_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Message send log
CREATE TABLE IF NOT EXISTS public.message_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid,
  template_id uuid,
  recipient_type text,
  recipient_name text,
  recipient_phone text,
  channel text NOT NULL CHECK (channel IN ('whatsapp','sms')),
  body_rendered text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view send log"
  ON public.message_send_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert send log"
  ON public.message_send_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_message_send_log_job ON public.message_send_log(job_id);
