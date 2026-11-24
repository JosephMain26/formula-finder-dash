-- 1. app_alerts
DROP POLICY IF EXISTS "Authenticated view alerts" ON public.app_alerts;
DROP POLICY IF EXISTS "Authenticated create alerts" ON public.app_alerts;
DROP POLICY IF EXISTS "Authenticated update alerts" ON public.app_alerts;

CREATE POLICY "Admins and managers view alerts"
ON public.app_alerts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers create alerts"
ON public.app_alerts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update alerts"
ON public.app_alerts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 2. notification_log
DROP POLICY IF EXISTS "Authenticated view notification_log" ON public.notification_log;

CREATE POLICY "Admins and managers view notification_log"
ON public.notification_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 3. role_permissions
DROP POLICY IF EXISTS "Authenticated view role_permissions" ON public.role_permissions;

CREATE POLICY "Users view own role_permissions or admin"
ON public.role_permissions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text = role_permissions.role_name
  )
);

-- 4. expense_line_items
DROP POLICY IF EXISTS "Authenticated can view expense line items" ON public.expense_line_items;
DROP POLICY IF EXISTS "Authenticated can insert expense line items" ON public.expense_line_items;
DROP POLICY IF EXISTS "Authenticated can update expense line items" ON public.expense_line_items;
DROP POLICY IF EXISTS "Authenticated can delete expense line items" ON public.expense_line_items;

CREATE POLICY "Admins and managers view expense line items"
ON public.expense_line_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers insert expense line items"
ON public.expense_line_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update expense line items"
ON public.expense_line_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers delete expense line items"
ON public.expense_line_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 5. clients
DROP POLICY IF EXISTS "Authenticated view clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated insert clients" ON public.clients;

CREATE POLICY "Staff view clients"
ON public.clients FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'tech'::public.app_role)
);

CREATE POLICY "Staff insert clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'tech'::public.app_role)
);

-- 6. expense_accounts
DROP POLICY IF EXISTS "Authenticated can view expense accounts" ON public.expense_accounts;
DROP POLICY IF EXISTS "Authenticated can insert expense accounts" ON public.expense_accounts;
DROP POLICY IF EXISTS "Authenticated can update expense accounts" ON public.expense_accounts;

CREATE POLICY "Admins and managers view expense accounts"
ON public.expense_accounts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers insert expense accounts"
ON public.expense_accounts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update expense accounts"
ON public.expense_accounts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 7. expenses
DROP POLICY IF EXISTS "Authenticated can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated can update expenses" ON public.expenses;

CREATE POLICY "Admins and managers view expenses"
ON public.expenses FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers insert expenses"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update expenses"
ON public.expenses FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 8. marketer_types
DROP POLICY IF EXISTS "Authenticated manage marketer_types" ON public.marketer_types;
DROP POLICY IF EXISTS "Public view marketer_types" ON public.marketer_types;

CREATE POLICY "Staff view marketer_types"
ON public.marketer_types FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'tech'::public.app_role)
);

CREATE POLICY "Admins and managers insert marketer_types"
ON public.marketer_types FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update marketer_types"
ON public.marketer_types FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers delete marketer_types"
ON public.marketer_types FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 9. parts_charges
DROP POLICY IF EXISTS "Authenticated view parts_charges" ON public.parts_charges;
DROP POLICY IF EXISTS "Authenticated create parts_charges" ON public.parts_charges;

CREATE POLICY "Admins and managers view parts_charges"
ON public.parts_charges FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers create parts_charges"
ON public.parts_charges FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 10. profiles
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users view own profile or admin/manager"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- 11. permissions
DROP POLICY IF EXISTS "Authenticated view permissions" ON public.permissions;

CREATE POLICY "Admins and managers view permissions"
ON public.permissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 12. expense_attachments
DROP POLICY IF EXISTS "Authenticated can view expense attachments" ON public.expense_attachments;
DROP POLICY IF EXISTS "Authenticated can insert expense attachments" ON public.expense_attachments;
DROP POLICY IF EXISTS "Authenticated can update expense attachments" ON public.expense_attachments;
DROP POLICY IF EXISTS "Authenticated can delete expense attachments" ON public.expense_attachments;

CREATE POLICY "Admins and managers view expense attachments"
ON public.expense_attachments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers insert expense attachments"
ON public.expense_attachments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update expense attachments"
ON public.expense_attachments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers delete expense attachments"
ON public.expense_attachments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 13. message_send_log
DROP POLICY IF EXISTS "Authenticated view send log" ON public.message_send_log;
DROP POLICY IF EXISTS "Authenticated insert send log" ON public.message_send_log;

CREATE POLICY "Admins and managers view send log"
ON public.message_send_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers insert send log"
ON public.message_send_log FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 14. job_installations
DROP POLICY IF EXISTS "Auth view job_installations" ON public.job_installations;
DROP POLICY IF EXISTS "Auth insert job_installations" ON public.job_installations;
DROP POLICY IF EXISTS "Auth update job_installations" ON public.job_installations;
DROP POLICY IF EXISTS "Auth delete job_installations" ON public.job_installations;

CREATE POLICY "Staff view job_installations"
ON public.job_installations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'tech'::public.app_role)
);

CREATE POLICY "Staff insert job_installations"
ON public.job_installations FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'tech'::public.app_role)
);

CREATE POLICY "Staff update job_installations"
ON public.job_installations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'tech'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'tech'::public.app_role)
);

CREATE POLICY "Admins and managers delete job_installations"
ON public.job_installations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 15. products
DROP POLICY IF EXISTS "Authenticated can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated can delete products" ON public.products;

CREATE POLICY "Staff view products"
ON public.products FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'tech'::public.app_role)
);

CREATE POLICY "Admins and managers insert products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update products"
ON public.products FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers delete products"
ON public.products FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 16. custom_roles
DROP POLICY IF EXISTS "Authenticated view custom roles" ON public.custom_roles;

CREATE POLICY "Admins and managers view custom roles"
ON public.custom_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 17. product_categories
DROP POLICY IF EXISTS "Authenticated can view categories" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated can insert categories" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated can update categories" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated can delete categories" ON public.product_categories;

CREATE POLICY "Staff view product categories"
ON public.product_categories FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public.has_role(auth.uid(), 'tech'::public.app_role)
);

CREATE POLICY "Admins and managers insert product categories"
ON public.product_categories FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update product categories"
ON public.product_categories FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers delete product categories"
ON public.product_categories FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 18. billing_documents
DROP POLICY IF EXISTS "Authenticated can view billing documents" ON public.billing_documents;
DROP POLICY IF EXISTS "Authenticated can create billing documents" ON public.billing_documents;
DROP POLICY IF EXISTS "Authenticated can update billing documents" ON public.billing_documents;
DROP POLICY IF EXISTS "Authenticated can delete billing documents" ON public.billing_documents;

CREATE POLICY "Admins and managers view billing documents"
ON public.billing_documents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers create billing documents"
ON public.billing_documents FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update billing documents"
ON public.billing_documents FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers delete billing documents"
ON public.billing_documents FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 19. billing_items
DROP POLICY IF EXISTS "Authenticated can view billing items" ON public.billing_items;
DROP POLICY IF EXISTS "Authenticated can create billing items" ON public.billing_items;
DROP POLICY IF EXISTS "Authenticated can update billing items" ON public.billing_items;
DROP POLICY IF EXISTS "Authenticated can delete billing items" ON public.billing_items;

CREATE POLICY "Admins and managers view billing items"
ON public.billing_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers create billing items"
ON public.billing_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers update billing items"
ON public.billing_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins and managers delete billing items"
ON public.billing_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- 20-25. storage.objects (check-photos & expense-files)
DROP POLICY IF EXISTS "Auth view check photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth update check photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete check photos" ON storage.objects;

CREATE POLICY "Staff or owner view check photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'check-photos'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'tech'::public.app_role)
  )
);

CREATE POLICY "Admins, managers, or owner update check photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'check-photos'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'check-photos'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

CREATE POLICY "Admins, managers, or owner delete check photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'check-photos'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Authenticated can view expense files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update expense files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete expense files" ON storage.objects;

CREATE POLICY "Admins, managers, or owner view expense files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-files'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

CREATE POLICY "Admins, managers, or owner update expense files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'expense-files'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'expense-files'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

CREATE POLICY "Admins, managers, or owner delete expense files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-files'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);