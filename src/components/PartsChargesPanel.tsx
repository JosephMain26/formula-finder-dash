import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DatePickerField } from "@/components/DatePickerField";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  loadPartsCharges,
  upsertPartsCharge,
  deletePartsCharge,
  type PartsCharge,
} from "@/lib/partsCharges";

function money(n: number) {
  const v = `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `-${v}` : v;
}

/**
 * Standalone Parts Charges ledger.
 *
 * Flat fees charged to a company/marketer for parts bought on their behalf.
 * Kept as its own screen (independent of the Marketer Balances report) so it
 * can be reconciled against a broader expense system later.
 */
export function PartsChargesPanel() {
  const [charges, setCharges] = useState<PartsCharge[]>([]);
  const [jobMarketers, setJobMarketers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [marketerFilter, setMarketerFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState("all"); // all | paid | unpaid
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PartsCharge> | null>(null);

  async function refreshCharges() {
    try {
      setCharges(await loadPartsCharges());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load parts charges");
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("jobs").select("company_1, company");
      setJobMarketers(
        ((data as any[]) || []).map((j) => (j.company_1 || j.company || "").trim()).filter(Boolean)
      );
      await refreshCharges();
      setLoading(false);
    })();
  }, []);

  const marketers = useMemo(
    () =>
      [...new Set([...jobMarketers, ...charges.map((c) => (c.marketer || "").trim())].filter(Boolean))].sort(),
    [jobMarketers, charges]
  );

  const filtered = useMemo(
    () =>
      charges.filter((c) => {
        if (marketerFilter !== "all" && (c.marketer || "").trim() !== marketerFilter) return false;
        if (paidFilter === "paid" && !c.paid) return false;
        if (paidFilter === "unpaid" && c.paid) return false;
        if (dateFrom && (!c.charge_date || c.charge_date < dateFrom)) return false;
        if (dateTo && (!c.charge_date || c.charge_date > dateTo)) return false;
        return true;
      }),
    [charges, marketerFilter, paidFilter, dateFrom, dateTo]
  );

  const totals = useMemo(() => {
    const all = filtered.reduce((a, c) => a + Number(c.amount || 0), 0);
    const unpaid = filtered.filter((c) => !c.paid).reduce((a, c) => a + Number(c.amount || 0), 0);
    return { all, unpaid, paid: all - unpaid };
  }, [filtered]);

  async function saveCharge() {
    if (!editing || !editing.marketer?.trim()) {
      toast.error("Pick a marketer/company");
      return;
    }
    try {
      await upsertPartsCharge({
        id: editing.id,
        marketer: editing.marketer.trim(),
        amount: Number(editing.amount) || 0,
        charge_date: editing.charge_date || null,
        description: editing.description || null,
        paid: !!editing.paid,
      });
      setEditorOpen(false);
      setEditing(null);
      await refreshCharges();
      toast.success("Parts charge saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    }
  }

  async function removeCharge(id: string) {
    try {
      await deletePartsCharge(id);
      await refreshCharges();
      toast.success("Parts charge deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  }

  async function toggleChargePaid(c: PartsCharge, paid: boolean) {
    try {
      await upsertPartsCharge({ ...c, paid });
      await refreshCharges();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={marketerFilter} onValueChange={setMarketerFilter}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Marketer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All marketers</SelectItem>
                {marketers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paidFilter} onValueChange={setPaidFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Paid status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All charges</SelectItem>
                <SelectItem value="unpaid">Unpaid only</SelectItem>
                <SelectItem value="paid">Paid only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <DatePickerField value={dateFrom} onChange={setDateFrom} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <DatePickerField value={dateTo} onChange={setDateTo} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Parts Charges</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Flat fees for parts you buy for a company — the company owes the office.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing({ marketer: "", amount: 0, charge_date: "", description: "", paid: false });
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add charge
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No parts charges match these filters.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-6 pb-4 text-sm">
                <span className="text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{money(totals.all)}</span>
                </span>
                <span className="text-muted-foreground">
                  Outstanding: <span className="font-semibold text-foreground">{money(totals.unpaid)}</span>
                </span>
                <span className="text-muted-foreground">
                  Paid: <span className="font-semibold text-foreground">{money(totals.paid)}</span>
                </span>
                <span className="text-muted-foreground">{filtered.length} charges</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Marketer / Company</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Paid</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className={cn(c.paid && "opacity-60")}>
                      <TableCell>{c.charge_date ? new Date(c.charge_date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="font-medium">{c.marketer || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.description || "—"}</TableCell>
                      <TableCell className="text-right">{money(Number(c.amount || 0))}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={c.paid}
                          onCheckedChange={(v) => toggleChargePaid(c, v === true)}
                          aria-label="Mark charge as paid"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(c); setEditorOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCharge(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit parts charge" : "Add parts charge"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Marketer / Company</Label>
                <Input
                  list="parts-charge-marketers-standalone"
                  value={editing.marketer || ""}
                  onChange={(e) => setEditing((s) => ({ ...s!, marketer: e.target.value }))}
                  placeholder="Company name"
                  className="h-9"
                />
                <datalist id="parts-charge-marketers-standalone">
                  {marketers.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.amount ?? 0}
                    onChange={(e) => setEditing((s) => ({ ...s!, amount: Number(e.target.value) }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Date</Label>
                  <DatePickerField
                    value={editing.charge_date || ""}
                    onChange={(v) => setEditing((s) => ({ ...s!, charge_date: v }))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Input
                  value={editing.description || ""}
                  onChange={(e) => setEditing((s) => ({ ...s!, description: e.target.value }))}
                  placeholder="e.g. door hardware, springs…"
                  className="h-9"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={!!editing.paid}
                  onCheckedChange={(v) => setEditing((s) => ({ ...s!, paid: v === true }))}
                />
                Mark as paid (excluded from balance report)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditorOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={saveCharge}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
