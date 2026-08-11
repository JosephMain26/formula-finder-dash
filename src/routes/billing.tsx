import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, Link2, CheckCircle2, FileUp, Mail } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { DocumentEditorDialog } from "@/components/billing/DocumentEditorDialog";
import { DocumentView } from "@/components/billing/DocumentView";
import { sendAutomationEmail } from "@/lib/automationEmail.functions";
import {
  approveManually, convertToInvoice, createShareLink, deleteDocument, loadDocuments,
  money, shareUrl, updateDocument, type BillingDoc, type DocKind,
} from "@/lib/billing";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Estimates & Invoices | Job Dashboard" },
      { name: "description", content: "Create estimates, collect client signatures, and turn approved estimates into invoices." },
      { property: "og:title", content: "Estimates & Invoices" },
      { property: "og:description", content: "Create estimates, collect client signatures, and convert them into invoices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPage,
});

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500 text-white",
  approved: "bg-green-500 text-white",
  declined: "bg-red-500 text-white",
  invoiced: "bg-purple-500 text-white",
  unpaid: "bg-yellow-400 text-black",
  paid: "bg-green-500 text-white",
};

function BillingPage() {
  const { displayName } = useAuth();
  const [docs, setDocs] = useState<BillingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewDoc, setViewDoc] = useState<BillingDoc | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setDocs(await loadDocuments());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      return [d.doc_number, d.client_name, d.client_email].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [docs, search, statusFilter]);

  async function approve(d: BillingDoc) {
    await approveManually(d.id!, displayName || "Office");
    toast.success("Estimate approved");
    refresh();
  }

  async function share(d: BillingDoc, alsoEmail: boolean) {
    try {
      const token = d.share_token || (await createShareLink(d.id!));
      const url = shareUrl(token);
      await navigator.clipboard.writeText(url).catch(() => {});
      if (alsoEmail) {
        if (!d.client_email) { toast.error("This client has no email address."); return; }
        await sendAutomationEmail({
          data: {
            to: d.client_email,
            subject: `Estimate ${d.doc_number} for your approval`,
            html: `<p>Hi ${d.client_name || "there"},</p><p>Your estimate ${d.doc_number} for ${money(d.total)} is ready for review.</p><p><a href="${url}">Review and sign the estimate</a></p>`,
          },
        });
        toast.success("Estimate emailed and link copied");
      } else {
        toast.success("Signing link copied to clipboard");
      }
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create link");
    }
  }

  async function convert(d: BillingDoc) {
    try {
      await convertToInvoice(d);
      toast.success("Invoice created from estimate");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Conversion failed");
    }
  }

  async function togglePaid(d: BillingDoc) {
    await updateDocument(d.id!, { paid: !d.paid, status: !d.paid ? "paid" : "unpaid", amount_paid: !d.paid ? d.total : 0 });
    refresh();
  }

  async function remove(d: BillingDoc) {
    if (!confirm(`Delete ${d.doc_number}?`)) return;
    await deleteDocument(d.id!);
    refresh();
  }

  function renderList(kind: DocKind) {
    const rows = filtered.filter((d) => d.kind === kind);
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{kind === "estimate" ? "Estimates" : "Invoices"}</CardTitle>
          <DocumentEditorDialog
            kind={kind}
            onSaved={refresh}
            trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> New {kind}</Button>}
          />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <Input placeholder="Search number, client…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(kind === "estimate" ? ["draft", "sent", "approved", "declined", "invoiced"] : ["unpaid", "paid"]).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No {kind}s yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.doc_number}</TableCell>
                      <TableCell className="text-sm">
                        {d.client_name || "—"}
                        {d.job_id && (
                          <Link to="/" className="ml-2 text-xs text-primary hover:underline">job linked</Link>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{d.issue_date || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_TONE[d.status] || STATUS_TONE.draft} capitalize`}>{d.status}</Badge>
                        {d.signed_at && <span className="ml-1 text-[10px] text-muted-foreground">signed</span>}
                      </TableCell>
                      <TableCell className="text-right">{money(d.total)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="View" onClick={() => setViewDoc(d)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <DocumentEditorDialog
                            kind={kind}
                            doc={d}
                            onSaved={refresh}
                            trigger={<Button variant="ghost" size="icon" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>}
                          />
                          {kind === "estimate" && d.status !== "approved" && d.status !== "invoiced" && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Approve manually" onClick={() => approve(d)}>
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Copy signing link" onClick={() => share(d, false)}>
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Email to client for signature" onClick={() => share(d, true)}>
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {kind === "estimate" && d.status === "approved" && (
                            <Button variant="outline" size="sm" className="h-7" onClick={() => convert(d)}>
                              <FileUp className="h-3.5 w-3.5 mr-1" /> To invoice
                            </Button>
                          )}
                          {kind === "invoice" && (
                            <Button variant="outline" size="sm" className="h-7" onClick={() => togglePaid(d)}>
                              {d.paid ? "Mark unpaid" : "Mark paid"}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => remove(d)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <MobileNav className="lg:hidden" />
          <Link to="/" className="hidden lg:inline-flex">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Button>
          </Link>
          <h1 className="text-lg font-semibold">Estimates &amp; Invoices</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="estimates">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="estimates">Estimates</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
          <TabsContent value="estimates">{renderList("estimate")}</TabsContent>
          <TabsContent value="invoices">{renderList("invoice")}</TabsContent>
        </Tabs>
      </main>

      <DocumentView doc={viewDoc} open={!!viewDoc} onOpenChange={(v) => !v && setViewDoc(null)} />
    </div>
  );
}
