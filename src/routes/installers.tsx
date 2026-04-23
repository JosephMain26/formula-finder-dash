import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";

type Installer = {
  id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  install_types: string[];
  created_at: string;
  updated_at: string;
};

const INSTALL_TYPE_OPTIONS = ["Residential", "Commercial"] as const;

export const Route = createFileRoute("/installers")({
  component: InstallersPage,
  head: () => ({
    meta: [
      { title: "Installers - Jobs Dashboard" },
      { name: "description", content: "Manage installers for door and opener jobs" },
    ],
  }),
});

function InstallersPage() {
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchInstallers() {
    setLoading(true);
    const { data } = await (supabase as any).from("installers").select("*").order("name");
    setInstallers((data as Installer[]) || []);
    setLoading(false);
  }

  useEffect(() => { fetchInstallers(); }, []);

  async function deleteInstaller(id: string) {
    if (!confirm("Are you sure you want to delete this installer?")) return;
    await (supabase as any).from("installers").delete().eq("id", id);
    fetchInstallers();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1200px] mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Installers</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage installers for doors and openers</p>
            </div>
          </div>
          <InstallerDialog onSaved={fetchInstallers} />
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Installers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : installers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">No installers yet</p>
                <p className="text-sm mt-1">Add your first installer to get started.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Install Types</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installers.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell className="font-medium">{inst.name}</TableCell>
                        <TableCell>{inst.phone_number || "—"}</TableCell>
                        <TableCell>{inst.email || "—"}</TableCell>
                        <TableCell>{inst.install_types?.length ? inst.install_types.join(", ") : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <InstallerDialog installer={inst} onSaved={fetchInstallers} />
                            <Button variant="ghost" size="icon" onClick={() => deleteInstaller(inst.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
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
      </main>
    </div>
  );
}

function InstallerDialog({ installer, onSaved }: { installer?: Installer; onSaved: () => void }) {
  const isEdit = !!installer;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: installer?.name || "",
    phone_number: installer?.phone_number || "",
    email: installer?.email || "",
    install_types: installer?.install_types || [],
  });

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleType(type: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...(form.install_types || []), type]))
      : (form.install_types || []).filter((t) => t !== type);
    update("install_types", next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);

    const payload = {
      name: form.name.trim(),
      phone_number: form.phone_number || null,
      email: form.email || null,
      install_types: form.install_types,
    };

    if (isEdit && installer) {
      await (supabase as any).from("installers").update(payload).eq("id", installer.id);
    } else {
      await (supabase as any).from("installers").insert(payload);
    }

    setLoading(false);
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button><Plus className="h-4 w-4 mr-2" /> Add Installer</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Installer" : "Add Installer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required maxLength={100} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
            <Input value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} maxLength={30} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} maxLength={255} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Install Types</label>
            <div className="mt-2 flex flex-col gap-2 rounded-lg border p-3 bg-muted/30">
              {INSTALL_TYPE_OPTIONS.map((type) => {
                const id = `inst-type-${type}`;
                const checked = form.install_types.includes(type);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <Checkbox id={id} checked={checked} onCheckedChange={(v) => toggleType(type, !!v)} />
                    <label htmlFor={id} className="text-sm cursor-pointer">{type}</label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : isEdit ? "Save" : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
