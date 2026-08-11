import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  computeTotals, docDiscountAmounts, emptyItem, itemNet, loadItems, makeId, money,
  newDoc, nextDocNumber, saveDocument,
  type BillingDoc, type BillingItem, type DiscountRule, type DocKind,
} from "@/lib/billing";

type ClientRow = { id: string; name: string; phone: string | null; email: string | null; address: string | null };
type JobRow = { id: string; po_number: string | null; job_date: string | null; address: string | null; price: number | null };

interface Props {
  kind: DocKind;
  doc?: BillingDoc;
  trigger: ReactNode;
  onSaved: () => void;
  presetJobId?: string | null;
}

export function DocumentEditorDialog({ kind, doc, trigger, onSaved, presetJobId }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BillingDoc>(doc ?? newDoc(kind, ""));
  const [items, setItems] = useState<BillingItem[]>([emptyItem(0)]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);

  useEffect(() => {
    if (!open) return;
    (supabase as any).from("clients").select("id,name,phone,email,address").order("name")
      .then(({ data }: any) => setClients((data as ClientRow[]) || []));
    (supabase as any).from("jobs").select("id,po_number,job_date,address,price")
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data }: any) => setJobs((data as JobRow[]) || []));

    if (doc?.id) {
      setForm(doc);
      loadItems(doc.id).then((rows) => setItems(rows.length ? rows : [emptyItem(0)]));
    } else {
      nextDocNumber(kind).then((n) => {
        setForm({ ...newDoc(kind, n), job_id: presetJobId ?? null });
      });
      setItems([emptyItem(0)]);
    }
  }, [open, doc, kind, presetJobId]);

  const totals = useMemo(() => computeTotals(items, form.discounts, form.tax_rate), [items, form.discounts, form.tax_rate]);
  const docAmounts = useMemo(() => docDiscountAmounts(items, form.discounts), [items, form.discounts]);

  const set = <K extends keyof BillingDoc>(k: K, v: BillingDoc[K]) => setForm((p) => ({ ...p, [k]: v }));

  function updateItem(idx: number, patch: Partial<BillingItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addDiscount() {
    const d: DiscountRule = { id: makeId(), label: "Discount", type: "percent", value: 0 };
    set("discounts", [...(form.discounts || []), d]);
  }

  function updateDiscount(id: string, patch: Partial<DiscountRule>) {
    set("discounts", (form.discounts || []).map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function save() {
    if (items.every((i) => !i.description.trim() && !Number(i.unit_price))) {
      toast.error("Add at least one line item.");
      return;
    }
    setSaving(true);
    try {
      await saveDocument(form, items.filter((i) => i.description.trim() || Number(i.unit_price)));
      toast.success(`${kind === "estimate" ? "Estimate" : "Invoice"} saved`);
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {doc?.id ? "Edit" : "New"} {kind === "estimate" ? "estimate" : "invoice"} {form.doc_number && `· ${form.doc_number}`}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Client</Label>
            <Select
              value={form.client_id || "__none__"}
              onValueChange={(id) => {
                if (id === "__none__") { set("client_id", null); return; }
                const c = clients.find((x) => x.id === id);
                setForm((p) => ({
                  ...p, client_id: id,
                  client_name: c?.name ?? null, client_email: c?.email ?? null,
                  client_phone: c?.phone ?? null, client_address: c?.address ?? null,
                }));
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Linked job (optional)</Label>
            <Select
              value={form.job_id || "__none__"}
              onValueChange={(id) => set("job_id", id === "__none__" ? null : id)}
            >
              <SelectTrigger><SelectValue placeholder="No job linked" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {(j.job_date || "no date")} · {j.po_number || j.address || j.id.slice(0, 6)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Client name (shown on document)</Label>
            <Input value={form.client_name || ""} onChange={(e) => set("client_name", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Client email</Label>
            <Input type="email" value={form.client_email || ""} onChange={(e) => set("client_email", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Issue date</Label>
            <Input type="date" value={form.issue_date || ""} onChange={(e) => set("issue_date", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{kind === "invoice" ? "Due date" : "Valid until"}</Label>
            <Input type="date" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} />
          </div>
        </div>

        {/* Line items */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Line items</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyItem(p.length)])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add item
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end rounded-md border p-2">
                <div className="col-span-12 sm:col-span-4">
                  <Label className="text-[10px] text-muted-foreground">Description</Label>
                  <Input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <Label className="text-[10px] text-muted-foreground">Qty</Label>
                  <Input type="number" step="0.01" value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} />
                </div>
                <div className="col-span-8 sm:col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Unit price</Label>
                  <Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Discount</Label>
                  <Select value={it.discount_type} onValueChange={(v) => updateItem(idx, { discount_type: v as BillingItem["discount_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fixed">$ Fixed</SelectItem>
                      <SelectItem value="percent">% Percent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <Label className="text-[10px] text-muted-foreground">Value</Label>
                  <Input
                    type="number" step="0.01" disabled={it.discount_type === "none"}
                    value={it.discount_value}
                    onChange={(e) => updateItem(idx, { discount_value: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-2 flex items-center justify-between gap-1">
                  <span className="text-sm font-medium whitespace-nowrap">{money(itemNet(it))}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Document discounts */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Document discounts</Label>
            <Button type="button" variant="outline" size="sm" onClick={addDiscount}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add discount
            </Button>
          </div>
          {(form.discounts || []).length === 0 && (
            <p className="text-xs text-muted-foreground">No document-level discounts. You can add as many as you need.</p>
          )}
          <div className="space-y-2">
            {(form.discounts || []).map((d, i) => (
              <div key={d.id} className="grid grid-cols-12 gap-2 items-end rounded-md border p-2">
                <div className="col-span-12 sm:col-span-5">
                  <Label className="text-[10px] text-muted-foreground">Label</Label>
                  <Input value={d.label} onChange={(e) => updateDiscount(d.id, { label: e.target.value })} />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Label className="text-[10px] text-muted-foreground">Type</Label>
                  <Select value={d.type} onValueChange={(v) => updateDiscount(d.id, { type: v as "fixed" | "percent" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">$ Fixed</SelectItem>
                      <SelectItem value="percent">% Percent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Value</Label>
                  <Input type="number" step="0.01" value={d.value} onChange={(e) => updateDiscount(d.id, { value: Number(e.target.value) })} />
                </div>
                <div className="col-span-2 flex items-center justify-between gap-1">
                  <span className="text-sm">-{money(docAmounts[i] || 0)}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => set("discounts", form.discounts.filter((x) => x.id !== d.id))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tax rate (%)</Label>
              <Input type="number" step="0.01" value={form.tax_rate} onChange={(e) => set("tax_rate", Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Terms</Label>
              <Textarea rows={2} value={form.terms || ""} onChange={(e) => set("terms", e.target.value)} />
            </div>
            {kind === "invoice" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Amount paid</Label>
                  <Input type="number" step="0.01" value={form.amount_paid} onChange={(e) => set("amount_paid", Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Payment method</Label>
                  <Input value={form.payment_method || ""} onChange={(e) => set("payment_method", e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <div className="rounded-md border p-3 text-sm space-y-1 h-fit">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Item discounts</span><span>-{money(totals.itemDiscountTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Document discounts</span><span>-{money(totals.docDiscountTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{money(totals.tax_total)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{money(totals.total)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
