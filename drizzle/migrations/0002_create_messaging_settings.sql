CREATE TABLE public.messaging_settings (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  provider TEXT NOT NULL DEFAULT 'twilio',
  account_sid TEXT NOT NULL,
  account_name TEXT,
  auth_token TEXT NOT NULL,
  from_number TEXT,
  phone_number_sid TEXT,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number TEXT,
  webhook_set BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_settings TO authenticated;
GRANT ALL ON public.messaging_settings TO service_role;

ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select messaging_settings"
  ON public.messaging_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert messaging_settings"
  ON public.messaging_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update messaging_settings"
  ON public.messaging_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete messaging_settings"
  ON public.messaging_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));