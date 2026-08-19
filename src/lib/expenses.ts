import { supabase } from "@/integrations/supabase/client";

/**
 * Expense system (ported from Expertus Billing).
 * An expense is one vendor invoice/receipt: uploaded pages (expense_attachments),
 * AI-extracted header fields, and line items.
 */

export const EXPENSE_BUCKET = "expense-files";

export type ExpenseStatus = "draft" | "confirmed" | "attached";

export interface Vendor {
  id: string;
  name: string;
  tax_id?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface ExpenseAccount {
  id: string;
  name: string;
  number?: string | null;
}

export interface ExpenseLineItem {
  id?: string;
  expense_id?: string;
  description: string | null;
  product_number: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  position: number;
}

export interface ExpenseAttachment {
  id: string;
  expense_id: string;
  file_path: string;
  file_mime: string | null;
  position: number;
}

export interface Expense {
  id: string;
  vendor_id: string | null;
  account_id: string | null;
  job_id: string | null;
  subject: string | null;
  invoice_number: string | null;
  customer_po: string | null;
  invoice_date: string | null;
  currency: string | null;
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total: number | null;
  notes: string | null;
  status: ExpenseStatus;
  created_at?: string;
  vendors?: { name: string } | null;
  expense_accounts?: { name: string } | null;
}

const db = supabase as any;

export const money = (n: number | null | undefined) =>
  `$${(Number(n ?? 0) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function loadVendors(): Promise<Vendor[]> {
  const { data, error } = await db.from("vendors").select("id, name, tax_id, phone, email, notes").order("name");
  if (error) throw error;
  return (data as Vendor[]) || [];
}

export async function loadExpenseAccounts(): Promise<ExpenseAccount[]> {
  const { data, error } = await db.from("expense_accounts").select("id, name, number").order("name");
  if (error) throw error;
  return (data as ExpenseAccount[]) || [];
}

export async function createExpenseAccount(name: string): Promise<ExpenseAccount> {
  const { data, error } = await db.from("expense_accounts").insert({ name: name.trim() }).select("id, name, number").single();
  if (error) throw error;
  return data as ExpenseAccount;
}

export async function createVendor(name: string): Promise<Vendor> {
  const { data, error } = await db.from("vendors").insert({ name: name.trim() }).select("id, name").single();
  if (error) throw error;
  return data as Vendor;
}

export async function loadExpenses(): Promise<Expense[]> {
  const { data, error } = await db
    .from("expenses")
    .select("*, vendors(name), expense_accounts(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Expense[]) || [];
}

export async function loadExpense(id: string): Promise<{
  expense: Expense;
  items: ExpenseLineItem[];
  pages: ExpenseAttachment[];
}> {
  const [{ data: expense, error }, { data: items }, { data: pages }] = await Promise.all([
    db.from("expenses").select("*, vendors(name), expense_accounts(name)").eq("id", id).single(),
    db.from("expense_line_items").select("*").eq("expense_id", id).order("position"),
    db.from("expense_attachments").select("*").eq("expense_id", id).order("position"),
  ]);
  if (error) throw error;
  return {
    expense: expense as Expense,
    items: (items as ExpenseLineItem[]) || [],
    pages: (pages as ExpenseAttachment[]) || [],
  };
}

/** Creates a draft expense and uploads the given files as its ordered pages. */
export async function createExpenseWithFiles(files: File[]): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id ?? null;
  const { data: created, error } = await db
    .from("expenses")
    .insert({ status: "draft", created_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  const expenseId = created.id as string;

  const rows: { expense_id: string; file_path: string; file_mime: string; position: number }[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split(".").pop() || "bin";
    const path = `${expenseId}/${i}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(EXPENSE_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (upErr) throw upErr;
    rows.push({ expense_id: expenseId, file_path: path, file_mime: file.type || null as any, position: i });
  }
  if (rows.length) {
    const { error: aErr } = await db.from("expense_attachments").insert(rows);
    if (aErr) throw aErr;
  }
  return expenseId;
}

export async function updateExpense(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from("expenses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function saveLineItems(expenseId: string, items: ExpenseLineItem[]): Promise<void> {
  await db.from("expense_line_items").delete().eq("expense_id", expenseId);
  const rows = items
    .filter((i) => (i.description || "").trim() || i.line_total != null)
    .map((i, idx) => ({
      expense_id: expenseId,
      description: i.description || null,
      product_number: i.product_number || null,
      quantity: i.quantity ?? null,
      unit_price: i.unit_price ?? null,
      line_total: i.line_total ?? null,
      position: idx,
    }));
  if (rows.length) {
    const { error } = await db.from("expense_line_items").insert(rows);
    if (error) throw error;
  }
}

export async function deleteExpense(id: string, pages: ExpenseAttachment[]): Promise<void> {
  const paths = pages.map((p) => p.file_path);
  if (paths.length) await supabase.storage.from(EXPENSE_BUCKET).remove(paths);
  const { error } = await db.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function signedPageUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(EXPENSE_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
