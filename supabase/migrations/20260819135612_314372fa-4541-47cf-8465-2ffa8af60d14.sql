-- Expense system (ported from Expertus Billing)
CREATE TYPE public.expense_status AS ENUM ('draft', 'confirmed', 'attached');

CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view vendors" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update vendors" ON public.vendors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete vendors" ON public.vendors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_vendors_name_lower ON public.vendors (LOWER(name));

CREATE TABLE public.expense_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  number TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_accounts TO authenticated;
GRANT ALL ON public.expense_accounts TO service_role;
ALTER TABLE public.expense_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expense accounts" ON public.expense_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert expense accounts" ON public.expense_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expense accounts" ON public.expense_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete expense accounts" ON public.expense_accounts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER expense_accounts_updated_at BEFORE UPDATE ON public.expense_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.expense_accounts(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  subject TEXT,
  invoice_number TEXT,
  customer_po TEXT,
  invoice_date DATE,
  currency TEXT DEFAULT 'USD',
  subtotal NUMERIC(14,2),
  tax_rate NUMERIC(6,3),
  tax_amount NUMERIC(14,2),
  total NUMERIC(14,2),
  notes TEXT,
  status public.expense_status NOT NULL DEFAULT 'draft',
  ai_raw JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_expenses_created_at ON public.expenses (created_at DESC);
CREATE INDEX idx_expenses_status ON public.expenses (status);
CREATE INDEX idx_expenses_job ON public.expenses (job_id);

CREATE TABLE public.expense_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  description TEXT,
  product_number TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity NUMERIC(14,3) DEFAULT 1,
  unit_price NUMERIC(14,2),
  line_total NUMERIC(14,2),
  position INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_line_items TO authenticated;
GRANT ALL ON public.expense_line_items TO service_role;
ALTER TABLE public.expense_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expense line items" ON public.expense_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert expense line items" ON public.expense_line_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expense line items" ON public.expense_line_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete expense line items" ON public.expense_line_items FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_expense_line_items_expense ON public.expense_line_items (expense_id, position);

CREATE TABLE public.expense_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_mime TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_attachments TO authenticated;
GRANT ALL ON public.expense_attachments TO service_role;
ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expense attachments" ON public.expense_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert expense attachments" ON public.expense_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expense attachments" ON public.expense_attachments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete expense attachments" ON public.expense_attachments FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_expense_attachments_expense ON public.expense_attachments (expense_id, position);

INSERT INTO public.expense_accounts (name) VALUES
  ('Parts & Materials'), ('Fuel'), ('Tools & Equipment'), ('Office Supplies'), ('Subcontractors'), ('Vehicle Maintenance'), ('Marketing'), ('Other');