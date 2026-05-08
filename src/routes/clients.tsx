import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ArrowLeft, ExternalLink } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { JobDialog } from "@/components/AddJobDialog";
import type { Tables } from "@/integrations/supabase/types";

type Client = {
  id: string;
  name: string;
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

  async function fetchClients() {
    setLoading(true);
    const { data } = await (supabase as any).from("clients").select("*").order("name");
    setClients((data as Client[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchClients();
    // Check for highlight param from URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const hl = params.get("highlight");
      if (hl) setHighlightId(hl);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.phone, c.email, c.address].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [clients, search]);

  async function confirmDelete() {
    if (!toDelete) return;
    const { error } = await (supabase as any).from("clients").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else toast.success("Client deleted");
    setToDelete(null);
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
          <ClientDialog onSaved={fetchClients} />
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">All Clients</CardTitle>
            <Input
              placeholder="Search name, phone, email, address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-9"
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
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[110px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className={highlightId === c.id ? "bg-primary/10 ring-1 ring-primary/30" : ""}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.phone || "—"}</TableCell>
                        <TableCell>{c.email || "—"}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{c.address || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{c.notes || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {canEdit && <ClientDialog client={c} onSaved={fetchClients} autoOpen={highlightId === c.id} onOpened={() => setHighlightId(null)} />}
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

function ClientDialog({ client, onSaved, autoOpen, onOpened }: { client?: Client; onSaved: () => void; autoOpen?: boolean; onOpened?: () => void }) {
  const isEdit = !!client;
  const [open, setOpen] = useState(false);

  // Auto-open when highlight param matches
  useEffect(() => {
    if (autoOpen && !open) {
      setOpen(true);
      onOpened?.();
    }
  }, [autoOpen]);
  const [loading, setLoading] = useState(false);
  const [linkedJobs, setLinkedJobs] = useState<LinkedJob[]>([]);
  const [editJob, setEditJob] = useState<Tables<"jobs"> | null>(null);
  const [form, setForm] = useState({
    name: client?.name || "",
    phone: client?.phone || "",
    email: client?.email || "",
    address: client?.address || "",
    notes: client?.notes || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: client?.name || "",
        phone: client?.phone || "",
        email: client?.email || "",
        address: client?.address || "",
        notes: client?.notes || "",
      });
      setLinkedJobs([]);
      if (isEdit && client) {
        (supabase as any)
          .from("jobs")
          .select("id,job_date,address,status,price,phone_no,tech_name")
          .eq("client_id", client.id)
          .order("job_date", { ascending: false })
          .then(({ data }: any) => setLinkedJobs((data as LinkedJob[]) || []));
      }
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
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { error } = isEdit && client
      ? await (supabase as any).from("clients").update(payload).eq("id", client.id)
      : await (supabase as any).from("clients").insert(payload);

    setLoading(false);
    if (error) {
      toast.error(error.message.includes("clients_phone_unique")
        ? "A client with this phone number already exists."
        : error.message);
      return;
    }
    toast.success(isEdit ? "Client updated" : "Client added");
    setOpen(false);
    onSaved();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {isEdit ? (
            <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
          ) : (
            <Button><Plus className="h-4 w-4 mr-2" /> Add Client</Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} required maxLength={120} />
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

            {/* Linked Jobs */}
            {isEdit && linkedJobs.length > 0 && (
              <div className="pt-3 border-t">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Linked Jobs ({linkedJobs.length})
                </label>
                <div className="mt-2 space-y-1 max-h-[180px] overflow-y-auto">
                  {linkedJobs.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      className="w-full text-left flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => {
                        // Fetch full job to open in JobDialog
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
              </div>
            )}
            {isEdit && linkedJobs.length === 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">No jobs linked to this client yet.</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : isEdit ? "Save" : "Add"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Job edit dialog opened from linked jobs */}
      {editJob && (
        <JobDialog
          job={editJob}
          open={!!editJob}
          onOpenChange={(o) => { if (!o) setEditJob(null); }}
          onJobSaved={() => {
            setEditJob(null);
            onSaved();
          }}
        />
      )}
    </>
  );
}
