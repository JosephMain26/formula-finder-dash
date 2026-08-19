import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Loader2, Receipt, Settings2 } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { toast } from "sonner";
import { ExpenseDialog } from "@/components/expenses/ExpenseDialog";
import { VendorsAccountsDialog } from "@/components/expenses/VendorsAccountsDialog";
import { parseExpense } from "@/lib/expenseAi.functions";
import { createExpenseWithFiles, loadExpenses, money, type Expense } from "@/lib/expenses";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses | Job Dashboard" },
      { name: "description", content: "Upload vendor invoices and receipts, let AI read the fields, and track business expenses by category." },
      { property: "og:title", content: "Expenses" },
      { property: "og:description", content: "Upload vendor invoices, extract fields with AI, and track expenses by category." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExpensesPage,
});

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-green-500 text-white",
  attached: "bg-blue-500 text-white",
};

function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  async function refresh() {
    setLoading(true);
    try {
      setRows(await loadExpenses());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.subject, r.invoice_number, r.customer_po, r.vendors?.name, r.expense_accounts?.name]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const total = useMemo(() => filtered.reduce((s, r) => s + (Number(r.total) || 0), 0), [filtered]);

  /** Upload all chosen files as one multi-page expense, then read it with AI. */
  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const id = await createExpenseWithFiles(Array.from(files));
      toast.success("Uploaded — reading with AI…");
      try {
        await parseExpense({ data: { expenseId: id } });
      } catch (e: any) {
        toast.error(e?.message || "AI could not read it — fill the fields manually");
      }
      await refresh();
      setOpenId(id);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <MobileNav className="lg:hidden" />
          <Link to="/" className="hidden lg:inline-flex">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Button>
          </Link>
          <h1 className="text-lg font-semibold">Expenses</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Vendor invoices &amp; receipts
              <span className="text-xs font-normal text-muted-foreground">· {money(total)}</span>
            </CardTitle>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                {uploading ? "Uploading…" : "Upload invoice"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Select all pages of one invoice at once — they are stored together and read as a single document.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <Input placeholder="Search vendor, subject, invoice #…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="attached">Attached</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No expenses yet — upload an invoice to start.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                        <TableCell className="text-sm">{r.invoice_date || (r.created_at || "").slice(0, 10) || "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{r.vendors?.name || "—"}</TableCell>
                        <TableCell className="text-sm">{r.subject || "—"}</TableCell>
                        <TableCell className="text-sm">{r.expense_accounts?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_TONE[r.status] || STATUS_TONE.draft} capitalize`}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{money(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <ExpenseDialog
        expenseId={openId}
        open={!!openId}
        onOpenChange={(v) => !v && setOpenId(null)}
        onChanged={refresh}
      />
    </div>
  );
}
