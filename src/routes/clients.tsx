import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ArrowLeft, ExternalLink, Building2, Phone, Mail, MapPin, StickyNote } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { JobDialog } from "@/components/AddJobDialog";
import { ImportClientsDialog } from "@/components/ImportClientsDialog";
import type { Tables } from "@/integrations/supabase/types";

type Client = {
  id: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

type LinkedJob = {
  id: string;
  job_date: string | null;
  address: string | null;
  status: string | null;
  price: number | null;
  phone_no: string | null;
  tech_name: string | null;
};

export const Route = createFileRoute("/clients")({
  component: ClientsPage,
  head: () => ({
    meta: [
      { title: "Clients - Jobs Dashboard" },
      { name: "description", content: "Manage clients and customers reused across jobs" },
    ],
  }),
});

function ClientsPage() {
  const { can, isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager || can("clients.edit");
  const canDelete = isAdmin || can("clients.delete");

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Split-screen profile (single click)
  const [profileClient, setProfileClient] = useState<Client | null>(null);
  // Edit form dialog (double click / add / edit button)
  const [formOpen, setFormOpen] = useState(false);
  const [formClient, setFormClient] = useState<Client | null>(null);

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchClients() {
    setLoading(true);
    const { data } = await (supabase as any).from("clients").select("*").order("name");
    setClients((data as Client[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchClients();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const hl = params.get("highlight");
      if (hl) setHighlightId(hl);
    }
  }, []);

  // Auto-open edit form when highlight param matches (kept from previous behavior)
  useEffect(() => {
    if (!highlightId || clients.length === 0) return;
    const match = clients.find((c) => c.id === highlightId);
    if (match) {
      openEdit(match);
      setHighlightId(null);
    }
  }, [highlightId, clients]);

  function openAdd() {
    setFormClient(null);
    setFormOpen(true);
  }
  function openEdit(c: Client) {
    setFormClient(c);
    setFormOpen(true);
  }
  function handleRowClick(c: Client) {
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setProfileClient(c);
    }, 220);
  }
  function handleRowDoubleClick(c: Client) {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    openEdit(c);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.company_name, c.phone, c.email, c.address].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [clients, search]);

  async function confirmDelete() {
    if (!toDelete) return;
    const { error } = await (supabase as any).from("clients").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else toast.success("Client deleted");
    setToDelete(null);
    if (profileClient?.id === toDelete.id) setProfileClient(null);
    fetchClients();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-3 sm:py-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <MobileNav className="lg:hidden" />
            <Link to="/" className="hidden lg:inline-flex">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">Clients</h1>
              <p className="hidden sm:block text-sm text-muted-foreground mt-0.5">Reusable customer records linked to jobs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImportClientsDialog onImported={fetchClients} />
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Client</Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-lg">All Clients</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Single-click a row to view profile · double-click to edit</p>
            </div>
            <Input
              placeholder="Search name, company, phone, email, address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs h-9"
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">No clients yet</p>
                <p className="text-sm mt-1">Add a client manually, or one will be saved automatically when you create a job.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[110px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow
                        key={c.id}
                        onClick={() => handleRowClick(c)}
                        onDoubleClick={() => handleRowDoubleClick(c)}
                        className={
                          "cursor-pointer select-none " +
                          (profileClient?.id === c.id ? "bg-primary/10 ring-1 ring-primary/30" : "")
                        }
                      >
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.company_name || "—"}</TableCell>
                        <TableCell>{c.phone || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{c.address || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{c.notes || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                            {canEdit && (
                              <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
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
      </main>

      {/* Split-screen profile */}
      <ClientProfileSheet
        client={profileClient}
        onOpenChange={(o) => { if (!o) setProfileClient(null); }}
        onEdit={(c) => { setProfileClient(null); openEdit(c); }}
        onJobSaved={fetchClients}
        canEdit={canEdit}
      />

      {/* Add / Edit form */}
      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        client={formClient}
        onSaved={(saved) => {
          fetchClients();
          if (saved && profileClient?.id === saved.id) setProfileClient(saved);
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-semibold">{toDelete?.name}</span>.
              Existing jobs that reference this client will keep their data, but the link will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientProfileSheet({
  client, onOpenChange, onEdit, onJobSaved, canEdit,
}: {
  client: Client | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (c: Client) => void;
  onJobSaved: () => void;
  canEdit: boolean;
}) {
  const [linkedJobs, setLinkedJobs] = useState<LinkedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [editJob, setEditJob] = useState<Tables<"jobs"> | null>(null);

  useEffect(() => {
    if (!client) { setLinkedJobs([]); return; }
    setLoadingJobs(true);
    (supabase as any)
      .from("jobs")
      .select("id,job_date,address,status,price,phone_no,tech_name")
      .eq("client_id", client.id)
      .order("job_date", { ascending: false })
      .then(({ data }: any) => {
        setLinkedJobs((data as LinkedJob[]) || []);
        setLoadingJobs(false);
      });
  }, [client]);

  const totalValue = linkedJobs.reduce((s, j) => s + (Number(j.price) || 0), 0);

  return (
    <>
      <Sheet open={!!client} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {client && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{client.name}</SheetTitle>
                {client.company_name && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> {client.company_name}
                  </p>
                )}
              </SheetHeader>

              {canEdit && (
                <div className="mt-4">
                  <Button className="w-full" onClick={() => onEdit(client)}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit Client
                  </Button>
                </div>
              )}

              {/* Contact details */}
              <div className="mt-6 space-y-3">
                <ProfileRow icon={<Phone className="h-4 w-4" />} label="Phone" value={client.phone} />
                <ProfileRow icon={<Mail className="h-4 w-4" />} label="Email" value={client.email} />
                <ProfileRow icon={<MapPin className="h-4 w-4" />} label="Address" value={client.address} />
                <ProfileRow icon={<StickyNote className="h-4 w-4" />} label="Notes" value={client.notes} />
              </div>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total jobs</p>
                  <p className="text-2xl font-bold">{linkedJobs.length}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total value</p>
                  <p className="text-2xl font-bold">${totalValue.toFixed(0)}</p>
                </div>
              </div>

              {/* Past jobs */}
              <div className="mt-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Past Jobs {linkedJobs.length > 0 && `(${linkedJobs.length})`}
                </p>
                {loadingJobs ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
                ) : linkedJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No jobs linked to this client yet.</p>
                ) : (
                  <div className="space-y-1">
                    {linkedJobs.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        className="w-full text-left flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          supabase.from("jobs").select("*").eq("id", j.id).single().then(({ data }) => {
                            if (data) setEditJob(data);
                          });
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-muted-foreground text-xs whitespace-nowrap">{j.job_date || "No date"}</span>
                          <span className="truncate">{j.address || j.phone_no || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{j.status}</span>
                          {j.price != null && <span className="text-xs font-medium">${Number(j.price).toFixed(0)}</span>}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {editJob && (
        <JobDialog
          job={editJob}
          open={!!editJob}
          onOpenChange={(o) => { if (!o) setEditJob(null); }}
          onJobSaved={() => {
            setEditJob(null);
            onJobSaved();
            // refresh linked jobs
            if (client) {
              (supabase as any)
                .from("jobs")
                .select("id,job_date,address,status,price,phone_no,tech_name")
                .eq("client_id", client.id)
                .order("job_date", { ascending: false })
                .then(({ data }: any) => setLinkedJobs((data as LinkedJob[]) || []));
            }
          }}
        />
      )}
    </>
  );
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

function ClientFormDialog({
  open, onOpenChange, client, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: Client | null;
  onSaved: (saved: Client | null) => void;
}) {
  const isEdit = !!client;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", company_name: "", phone: "", email: "", address: "", notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: client?.name || "",
        company_name: client?.company_name || "",
        phone: client?.phone || "",
        email: client?.email || "",
        address: client?.address || "",
        notes: client?.notes || "",
      });
    }
  }, [open, client]);

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);

    const payload = {
      name: form.name.trim(),
      company_name: form.company_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { data, error } = isEdit && client
      ? await (supabase as any).from("clients").update(payload).eq("id", client.id).select().single()
      : await (supabase as any).from("clients").insert(payload).select().single();

    setLoading(false);
    if (error) {
      toast.error(error.message.includes("clients_phone_unique")
        ? "A client with this phone number already exists."
        : error.message);
      return;
    }
    toast.success(isEdit ? "Client updated" : "Client added");
    onOpenChange(false);
    onSaved((data as Client) || null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg w-[calc(100vw-1rem)] sm:w-[calc(100%-2rem)] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Client" : "Add Client"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required maxLength={120} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Company</label>
            <Input value={form.company_name} onChange={(e) => update("company_name", e.target.value)} maxLength={160} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} maxLength={40} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} maxLength={255} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Address</label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} maxLength={300} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} maxLength={500} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : isEdit ? "Save" : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
