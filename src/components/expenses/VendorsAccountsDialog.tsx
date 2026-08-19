import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, any>;

/** Manage vendors and spending categories (chart of accounts) — same flow as Invoice Genie. */
export function VendorsAccountsDialog({
  open,
  onOpenChange,
  onChanged,
  initialTab = "vendors",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
  initialTab?: "vendors" | "accounts";
}) {
  const [tab, setTab] = useState<string>(initialTab);
  const [vendors, setVendors] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [editing, setEditing] = useState<{ table: "vendors" | "expense_accounts"; row: Row } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  async function refresh() {
    const [v, a] = await Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("expense_accounts").select("*").order("name"),
    ]);
    setVendors(v.data ?? []);
    setAccounts(a.data ?? []);
    onChanged?.();
  }

  useEffect(() => { if (open) refresh(); }, [open]);

  async function save() {
    if (!editing) return;
    const { table, row } = editing;
    if (!String(row.name || "").trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const patch: Row = { name: row.name.trim(), notes: row.notes || null };
      if (table === "vendors") {
        patch.tax_id = row.tax_id || null;
        patch.phone = row.phone || null;
        patch.email = row.email || null;
      } else {
        patch.number = row.number || null;
      }
      if (row.id) {
        const { error } = await (supabase.from(table) as any).update(patch).eq("id", row.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await (supabase.from(table) as any).insert({ ...patch, created_by: u?.user?.id ?? null });
        if (error) throw error;
      }
      toast.success("Saved");
      setEditing(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(table: "vendors" | "expense_accounts", id: string) {
    if (!confirm("Delete this entry?")) return;
    const { error } = await (supabase.from(table) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refresh();
  }

  const form = editing?.row;
  const isVendor = editing?.table === "vendors";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Vendors &amp; categories</DialogTitle></DialogHeader>

        {editing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{form?.id ? "Edit" : "New"} {isVendor ? "vendor" : "category"}</p>
              <Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-1.5"><Label>Name</Label>
              <Input value={form?.name ?? ""} onChange={(e) => setEditing({ ...editing, row: { ...form, name: e.target.value } })} />
            </div>
            {isVendor ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>Tax ID</Label>
                  <Input value={form?.tax_id ?? ""} onChange={(e) => setEditing({ ...editing, row: { ...form, tax_id: e.target.value } })} /></div>
                <div className="space-y-1.5"><Label>Phone</Label>
                  <Input value={form?.phone ?? ""} onChange={(e) => setEditing({ ...editing, row: { ...form, phone: e.target.value } })} /></div>
                <div className="space-y-1.5"><Label>Email</Label>
                  <Input value={form?.email ?? ""} onChange={(e) => setEditing({ ...editing, row: { ...form, email: e.target.value } })} /></div>
              </div>
            ) : (
              <div className="space-y-1.5"><Label>Number</Label>
                <Input value={form?.number ?? ""} onChange={(e) => setEditing({ ...editing, row: { ...form, number: e.target.value } })} /></div>
            )}
            <div className="space-y-1.5"><Label>Notes</Label>
              <Textarea rows={2} value={form?.notes ?? ""} onChange={(e) => setEditing({ ...editing, row: { ...form, notes: e.target.value } })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>Save</Button>
            </div>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="vendors">Vendors</TabsTrigger>
              <TabsTrigger value="accounts">Categories</TabsTrigger>
            </TabsList>

            <TabsContent value="vendors" className="space-y-2">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setEditing({ table: "vendors", row: {} })}><Plus className="h-4 w-4 mr-1" /> New vendor</Button>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[520px]">
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Tax ID</TableHead><TableHead>Phone</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
                  <TableBody>
                    {vendors.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No vendors yet — they are auto-created when AI reads an invoice.</TableCell></TableRow>
                    ) : vendors.map((v) => (
                      <TableRow key={v.id} className="cursor-pointer" onClick={() => setEditing({ table: "vendors", row: v })}>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell>{v.tax_id || "—"}</TableCell>
                        <TableCell>{v.phone || "—"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" onClick={() => remove("vendors", v.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="accounts" className="space-y-2">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setEditing({ table: "expense_accounts", row: {} })}><Plus className="h-4 w-4 mr-1" /> New category</Button>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[520px]">
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Number</TableHead><TableHead>Notes</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
                  <TableBody>
                    {accounts.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No categories yet.</TableCell></TableRow>
                    ) : accounts.map((a) => (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => setEditing({ table: "expense_accounts", row: a })}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.number || "—"}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[220px] truncate">{a.notes || "—"}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" onClick={() => remove("expense_accounts", a.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
