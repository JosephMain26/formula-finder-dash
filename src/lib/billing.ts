import { supabase } from "@/integrations/supabase/client";

export type DocKind = "estimate" | "invoice";
export type DiscountType = "none" | "fixed" | "percent";

export interface DiscountRule {
  id: string;
  label: string;
  type: "fixed" | "percent";
  value: number;
}

export interface BillingItem {
  id?: string;
  description: string;
  qty: number;
  unit_price: number;
  discount_type: DiscountType;
  discount_value: number;
  sort_order: number;
}

export interface BillingDoc {
  id?: string;
  kind: DocKind;
  doc_number: string;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  job_id: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  tax_rate: number;
  notes: string | null;
  terms: string | null;
  discounts: DiscountRule[];
  photos: string[];
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  payment_method: string | null;
  paid: boolean;
  approval_mode: string | null;
  approved_by: string | null;
  approved_at: string | null;
  signer_name: string | null;
  signature_data_url: string | null;
  signed_ip: string | null;
  signed_at: string | null;
  signed_user_agent: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  converted_from: string | null;
  converted_to: string | null;
  created_at?: string;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round = (n: number) => Math.round(n * 100) / 100;

export function money(n: number | null | undefined) {
  return `$${num(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyItem(sort_order = 0): BillingItem {
  return { description: "", qty: 1, unit_price: 0, discount_type: "none", discount_value: 0, sort_order };
}

export function itemGross(i: BillingItem) {
  return round(num(i.qty) * num(i.unit_price));
}

export function itemDiscount(i: BillingItem) {
  const gross = itemGross(i);
  if (i.discount_type === "fixed") return round(Math.min(gross, num(i.discount_value)));
  if (i.discount_type === "percent") return round((gross * num(i.discount_value)) / 100);
  return 0;
}

export function itemNet(i: BillingItem) {
  return round(itemGross(i) - itemDiscount(i));
}

export interface Totals {
  subtotal: number;
  itemDiscountTotal: number;
  docDiscountTotal: number;
  discount_total: number;
  taxable: number;
  tax_total: number;
  total: number;
}

/** Subtotal -> per-item discounts -> document discounts (in order) -> tax. */
export function computeTotals(items: BillingItem[], discounts: DiscountRule[], taxRate: number): Totals {
  const subtotal = round(items.reduce((s, i) => s + itemGross(i), 0));
  const itemDiscountTotal = round(items.reduce((s, i) => s + itemDiscount(i), 0));
  let base = round(subtotal - itemDiscountTotal);
  let docDiscountTotal = 0;
  for (const d of discounts || []) {
    const amt = d.type === "percent" ? round((base * num(d.value)) / 100) : round(Math.min(base, num(d.value)));
    docDiscountTotal = round(docDiscountTotal + amt);
    base = round(base - amt);
  }
  const taxable = Math.max(0, base);
  const tax_total = round((taxable * num(taxRate)) / 100);
  return {
    subtotal,
    itemDiscountTotal,
    docDiscountTotal,
    discount_total: round(itemDiscountTotal + docDiscountTotal),
    taxable,
    tax_total,
    total: round(taxable + tax_total),
  };
}

export function docDiscountAmounts(items: BillingItem[], discounts: DiscountRule[]): number[] {
  let base = round(items.reduce((s, i) => s + itemNet(i), 0));
  return (discounts || []).map((d) => {
    const amt = d.type === "percent" ? round((base * num(d.value)) / 100) : round(Math.min(base, num(d.value)));
    base = round(base - amt);
    return amt;
  });
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  declined: "Declined",
  invoiced: "Invoiced",
  unpaid: "Unpaid",
  paid: "Paid",
};

// ---------- mapping ----------
function mapDoc(r: any): BillingDoc {
  return {
    id: r.id,
    kind: r.kind,
    doc_number: r.doc_number,
    client_id: r.client_id ?? null,
    client_name: r.client_name ?? null,
    client_email: r.client_email ?? null,
    client_phone: r.client_phone ?? null,
    client_address: r.client_address ?? null,
    job_id: r.job_id ?? null,
    status: r.status || "draft",
    issue_date: r.issue_date ?? null,
    due_date: r.due_date ?? null,
    tax_rate: num(r.tax_rate),
    notes: r.notes ?? null,
    terms: r.terms ?? null,
    discounts: Array.isArray(r.discounts) ? (r.discounts as DiscountRule[]) : [],
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
    subtotal: num(r.subtotal),
    discount_total: num(r.discount_total),
    tax_total: num(r.tax_total),
    total: num(r.total),
    amount_paid: num(r.amount_paid),
    payment_method: r.payment_method ?? null,
    paid: !!r.paid,
    approval_mode: r.approval_mode ?? null,
    approved_by: r.approved_by ?? null,
    approved_at: r.approved_at ?? null,
    signer_name: r.signer_name ?? null,
    signature_data_url: r.signature_data_url ?? null,
    signed_ip: r.signed_ip ?? null,
    signed_at: r.signed_at ?? null,
    signed_user_agent: r.signed_user_agent ?? null,
    share_token: r.share_token ?? null,
    share_expires_at: r.share_expires_at ?? null,
    converted_from: r.converted_from ?? null,
    converted_to: r.converted_to ?? null,
    created_at: r.created_at,
  };
}

function mapItem(r: any): BillingItem {
  return {
    id: r.id,
    description: r.description || "",
    qty: num(r.qty),
    unit_price: num(r.unit_price),
    discount_type: (r.discount_type || "none") as DiscountType,
    discount_value: num(r.discount_value),
    sort_order: num(r.sort_order),
  };
}

// ---------- CRUD ----------
export async function loadDocuments(kind?: DocKind): Promise<BillingDoc[]> {
  let q = (supabase as any).from("billing_documents").select("*").order("created_at", { ascending: false });
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw error;
  return ((data as any[]) || []).map(mapDoc);
}

export async function loadDocumentsForJob(jobId: string): Promise<BillingDoc[]> {
  const { data, error } = await (supabase as any)
    .from("billing_documents").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as any[]) || []).map(mapDoc);
}

export async function loadItems(documentId: string): Promise<BillingItem[]> {
  const { data, error } = await (supabase as any)
    .from("billing_items").select("*").eq("document_id", documentId).order("sort_order");
  if (error) throw error;
  return ((data as any[]) || []).map(mapItem);
}

export async function nextDocNumber(kind: DocKind): Promise<string> {
  const { data } = await (supabase as any)
    .from("billing_documents").select("doc_number").eq("kind", kind)
    .order("created_at", { ascending: false }).limit(1);
  const prefix = kind === "estimate" ? "EST" : "INV";
  const last = (data as any[])?.[0]?.doc_number as string | undefined;
  const lastNum = last ? parseInt(last.replace(/\D+/g, ""), 10) : NaN;
  const next = Number.isFinite(lastNum) ? lastNum + 1 : 1001;
  return `${prefix}-${next}`;
}

export function newDoc(kind: DocKind, doc_number: string): BillingDoc {
  return {
    kind,
    doc_number,
    client_id: null,
    client_name: null,
    client_email: null,
    client_phone: null,
    client_address: null,
    job_id: null,
    status: kind === "estimate" ? "draft" : "unpaid",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: null,
    tax_rate: 0,
    notes: null,
    terms: null,
    discounts: [],
    photos: [],
    subtotal: 0,
    discount_total: 0,
    tax_total: 0,
    total: 0,
    amount_paid: 0,
    payment_method: null,
    paid: false,
    approval_mode: null,
    approved_by: null,
    approved_at: null,
    signer_name: null,
    signature_data_url: null,
    signed_ip: null,
    signed_at: null,
    signed_user_agent: null,
    share_token: null,
    share_expires_at: null,
    converted_from: null,
    converted_to: null,
  };
}

/** Save a document + its items. Returns the document id. */
export async function saveDocument(doc: BillingDoc, items: BillingItem[]): Promise<string> {
  const t = computeTotals(items, doc.discounts, doc.tax_rate);
  const payload: Record<string, unknown> = {
    kind: doc.kind,
    doc_number: doc.doc_number,
    client_id: doc.client_id || null,
    client_name: doc.client_name || null,
    client_email: doc.client_email || null,
    client_phone: doc.client_phone || null,
    client_address: doc.client_address || null,
    job_id: doc.job_id || null,
    status: doc.status,
    issue_date: doc.issue_date || null,
    due_date: doc.due_date || null,
    tax_rate: num(doc.tax_rate),
    notes: doc.notes || null,
    terms: doc.terms || null,
    discounts: doc.discounts || [],
    photos: doc.photos || [],
    subtotal: t.subtotal,
    discount_total: t.discount_total,
    tax_total: t.tax_total,
    total: t.total,
    amount_paid: num(doc.amount_paid),
    payment_method: doc.payment_method || null,
    paid: !!doc.paid,
  };

  let id = doc.id;
  if (id) {
    const { error } = await (supabase as any).from("billing_documents").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any)
      .from("billing_documents")
      .insert({ ...payload, created_by: user?.user?.id ?? null })
      .select("id").single();
    if (error) throw error;
    id = (data as any).id as string;
  }

  const existing = await loadItems(id!);
  const keptIds = new Set(items.map((i) => i.id).filter(Boolean) as string[]);
  const toDelete = existing.filter((e) => e.id && !keptIds.has(e.id)).map((e) => e.id!);
  if (toDelete.length) {
    await (supabase as any).from("billing_items").delete().in("id", toDelete);
  }
  for (const [idx, i] of items.entries()) {
    const row = {
      document_id: id,
      description: i.description || "",
      qty: num(i.qty),
      unit_price: num(i.unit_price),
      discount_type: i.discount_type || "none",
      discount_value: num(i.discount_value),
      sort_order: idx,
    };
    if (i.id) {
      await (supabase as any).from("billing_items").update(row).eq("id", i.id);
    } else {
      await (supabase as any).from("billing_items").insert(row);
    }
  }
  return id!;
}

export async function deleteDocument(id: string) {
  const { error } = await (supabase as any).from("billing_documents").delete().eq("id", id);
  if (error) throw error;
}

export async function updateDocument(id: string, patch: Record<string, unknown>) {
  const { error } = await (supabase as any).from("billing_documents").update(patch).eq("id", id);
  if (error) throw error;
}

export async function approveManually(id: string, byName: string) {
  await updateDocument(id, {
    status: "approved",
    approval_mode: "manual",
    approved_by: byName,
    approved_at: new Date().toISOString(),
  });
}

export async function createShareLink(id: string, days = 30): Promise<string> {
  const token = `${makeId()}${makeId()}${makeId()}`;
  await updateDocument(id, {
    share_token: token,
    share_expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    status: "sent",
  });
  return token;
}

export function shareUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/sign/${token}`;
}

/** Copy an approved estimate into a new invoice. */
export async function convertToInvoice(estimate: BillingDoc): Promise<string> {
  const items = await loadItems(estimate.id!);
  const doc_number = await nextDocNumber("invoice");
  const invoice: BillingDoc = {
    ...estimate,
    id: undefined,
    kind: "invoice",
    doc_number,
    status: "unpaid",
    paid: false,
    amount_paid: 0,
    issue_date: new Date().toISOString().slice(0, 10),
    share_token: null,
    share_expires_at: null,
    converted_from: estimate.id!,
    converted_to: null,
  };
  const newId = await saveDocument(invoice, items.map((i) => ({ ...i, id: undefined })));
  await updateDocument(estimate.id!, { status: "invoiced", converted_to: newId });
  return newId;
}
