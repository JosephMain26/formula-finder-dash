import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trash2, Plus, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseExpense } from "@/lib/expenseAi.functions";
import {
  deleteExpense, loadExpense, loadExpenseAccounts, loadVendors, money, saveLineItems,
  signedPageUrl, updateExpense,
  type Expense, type ExpenseAccount, type ExpenseAttachment, type ExpenseLineItem, type Vendor,
} from "@/lib/expenses";

interface Props {
  expenseId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

const emptyItem = (position: number): ExpenseLineItem => ({
  description: "",
  product_number: "",
  quantity: 1,
  unit_price: null,
  line_total: null,
  position,
});

export function ExpenseDialog({ expenseId, open, onOpenChange, onChanged }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [form, setForm] = useState<Expense | null>(null);
  const [items, setItems] = useState<ExpenseLineItem[]>([]);
  const [pages, setPages] = useState<ExpenseAttachment[]>([]);
  const [pageUrls, setPageUrls] = useState<(string | null)[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<ExpenseAccount[]>([]);

  async function refresh() {
    if (!expenseId) return;
    setLoading(true);
    try {
      const [res, v, a] = await Promise.all([loadExpense(expenseId), loadVendors(), loadExpenseAccounts()]);
      setForm(res.expense);
      setItems(res.items.length ? res.items : [emptyItem(0)]);
      setPages(res.pages);
      setVendors(v);
      setAccounts(a);
      setPageIdx(0);
      setPageUrls(await Promise.all(res.pages.map((p) => signedPageUrl(p.file_path))));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load expense");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && expenseId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expenseId]);

  const itemsTotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.line_total ?? (Number(i.quantity ?? 0) * Number(i.unit_price ?? 0))) || 0), 0),
    [items],
  );

  function setField<K extends keyof Expense>(key: K, value: Expense[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function setItem(idx: number, patch: Partial<ExpenseLineItem>) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function runParse() {
    if (!expenseId) return;
    setParsing(true);
    try {
      await parseExpense({ data: { expenseId } });
      toast.success("Invoice read by AI");
      await refresh();
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "AI could not read the invoice");
    } finally {
      setParsing(false);
    }
  }

  async function save(nextStatus?: Expense["status"]) {
    if (!expenseId || !form) return;
    setSaving(true);
    try {
      await updateExpense(expenseId, {
        vendor_id: form.vendor_id || null,
        account_id: form.account_id || null,
        subject: form.subject || null,
        invoice_number: form.invoice_number || null,
        customer_po: form.customer_po || null,
        invoice_date: form.invoice_date || null,
        currency: form.currency || "USD",
        subtotal: form.subtotal ?? null,
        tax_rate: form.tax_rate ?? null,
        tax_amount: form.tax_amount ?? null,
        total: form.total ?? null,
        notes: form.notes || null,
        status: nextStatus || form.status,
      });
      await saveLineItems(expenseId, items);
      toast.success(nextStatus === "confirmed" ? "Expense confirmed" : "Saved");
      onChanged();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!expenseId) return;
    if (!confirm("Delete this expense and its files?")) return;
    try {
      await deleteExpense(expenseId, pages);
      toast.success("Expense deleted");
      onChanged();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  const currentPage = pages[pageIdx];
  const currentUrl = pageUrls[pageIdx];
  const isPdf = (currentPage?.file_mime || "").includes("pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            Review expense
            {form && <Badge variant="outline" className="capitalize">{form.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading || !form ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Pages */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {pages.length ? `Page ${pageIdx + 1} of ${pages.length}` : "No files"}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pageIdx === 0}
                    onClick={() => setPageIdx((i) => i - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pageIdx >= pages.length - 1}
                    onClick={() => setPageIdx((i) => i + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 min-h-[220px] flex items-center justify-center overflow-hidden">
                {!currentUrl ? (
                  <span className="text-xs text-muted-foreground p-4">Nothing to preview</span>
                ) : isPdf ? (
                  <a href={currentUrl} target="_blank" rel="noreferrer"
                    className="text-sm text-primary inline-flex items-center gap-1 p-6">
                    Open PDF <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <a href={currentUrl} target="_blank" rel="noreferrer">
                    <img src={currentUrl} alt={`Invoice page ${pageIdx + 1}`} className="max-h-[420px] w-full object-contain" />
                  </a>
                )}
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={runParse} disabled={parsing || !pages.length}>
                <Sparkles className="h-4 w-4 mr-1" /> {parsing ? "Reading…" : "Read with AI"}
              </Button>
            </div>

            {/* Fields */}
            <div className="lg:col-span-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Vendor</Label>
                  <Select value={form.vendor_id || ""} onValueChange={(v) => setField("vendor_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={form.account_id || ""} onValueChange={(v) => setField("account_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}{a.number ? ` (${a.number})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Subject</Label>
                  <Input value={form.subject || ""} onChange={(e) => setField("subject", e.target.value)} placeholder="Category — Vendor #Ref" />
                </div>
                <div>
                  <Label className="text-xs">Invoice #</Label>
                  <Input value={form.invoice_number || ""} onChange={(e) => setField("invoice_number", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Customer PO</Label>
                  <Input value={form.customer_po || ""} onChange={(e) => setField("customer_po", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Invoice date</Label>
                  <Input type="date" value={form.invoice_date || ""} onChange={(e) => setField("invoice_date", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input value={form.currency || "USD"} onChange={(e) => setField("currency", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Subtotal</Label>
                  <Input type="number" step="0.01" value={form.subtotal ?? ""} onChange={(e) => setField("subtotal", e.target.value === "" ? null : Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Tax rate (%)</Label>
                  <Input type="number" step="0.001" value={form.tax_rate ?? ""} onChange={(e) => setField("tax_rate", e.target.value === "" ? null : Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Tax amount</Label>
                  <Input type="number" step="0.01" value={form.tax_amount ?? ""} onChange={(e) => setField("tax_amount", e.target.value === "" ? null : Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Total</Label>
                  <Input type="number" step="0.01" value={form.total ?? ""} onChange={(e) => setField("total", e.target.value === "" ? null : Number(e.target.value))} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea rows={2} value={form.notes || ""} onChange={(e) => setField("notes", e.target.value)} />
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Line items · {money(itemsTotal)}</Label>
                  <Button variant="outline" size="sm" className="h-7" onClick={() => setItems((r) => [...r, emptyItem(r.length)])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add line
                  </Button>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                      <Input className="col-span-12 sm:col-span-5" placeholder="Description"
                        value={it.description || ""} onChange={(e) => setItem(idx, { description: e.target.value })} />
                      <Input className="col-span-4 sm:col-span-2" placeholder="SKU"
                        value={it.product_number || ""} onChange={(e) => setItem(idx, { product_number: e.target.value })} />
                      <Input className="col-span-2 sm:col-span-1" type="number" step="0.01" placeholder="Qty"
                        value={it.quantity ?? ""} onChange={(e) => setItem(idx, { quantity: e.target.value === "" ? null : Number(e.target.value) })} />
                      <Input className="col-span-3 sm:col-span-2" type="number" step="0.01" placeholder="Price"
                        value={it.unit_price ?? ""} onChange={(e) => setItem(idx, { unit_price: e.target.value === "" ? null : Number(e.target.value) })} />
                      <Input className="col-span-2 sm:col-span-1" type="number" step="0.01" placeholder="Total"
                        value={it.line_total ?? ""} onChange={(e) => setItem(idx, { line_total: e.target.value === "" ? null : Number(e.target.value) })} />
                      <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8"
                        onClick={() => setItems((r) => r.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={remove} className="sm:mr-auto text-destructive">
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <Button variant="outline" onClick={() => save()} disabled={saving || loading}>Save draft</Button>
          <Button onClick={() => save("confirmed")} disabled={saving || loading}>Save &amp; confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
