CREATE TABLE public.billing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('estimate','invoice')),
  doc_number text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  client_email text,
  client_phone text,
  client_address text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  issue_date date DEFAULT CURRENT_DATE,
  due_date date,
  tax_rate numeric NOT NULL DEFAULT 0,
  notes text,
  terms text,
  discounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_method text,
  paid boolean NOT NULL DEFAULT false,
  approval_mode text,
  approved_by text,
  approved_at timestamptz,
  signer_name text,
  signature_data_url text,
  signed_ip text,
  signed_at timestamptz,
  signed_user_agent text,
  share_token text UNIQUE,
  share_expires_at timestamptz,
  converted_from uuid,
  converted_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_documents TO authenticated;
GRANT ALL ON public.billing_documents TO service_role;
ALTER TABLE public.billing_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view billing documents" ON public.billing_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create billing documents" ON public.billing_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update billing documents" ON public.billing_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete billing documents" ON public.billing_documents FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_billing_documents_kind ON public.billing_documents(kind);
CREATE INDEX idx_billing_documents_job ON public.billing_documents(job_id);

CREATE TRIGGER billing_documents_updated_at BEFORE UPDATE ON public.billing_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.billing_documents(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','fixed','percent')),
  discount_value numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_items TO authenticated;
GRANT ALL ON public.billing_items TO service_role;
ALTER TABLE public.billing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view billing items" ON public.billing_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create billing items" ON public.billing_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update billing items" ON public.billing_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete billing items" ON public.billing_items FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_billing_items_document ON public.billing_items(document_id);

CREATE TRIGGER billing_items_updated_at BEFORE UPDATE ON public.billing_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();