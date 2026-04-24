import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ArrowLeft, Eye, EyeOff, RefreshCw } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { toast } from "sonner";

type Technician = {
  id: string;
  tech_name: string;
  phone_number: string | null;
  city: string | null;
  percentage: number | null;
  user_id: string | null;
  pincode: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileLite = { id: string; display_name: string | null; email: string | null };

export const Route = createFileRoute("/technicians")({
  component: TechniciansPage,
  head: () => ({
    meta: [
      { title: "Technicians - Jobs Dashboard" },
      { name: "description", content: "Manage technicians and their revenue percentages" },
    ],
  }),
});

function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPins, setShowPins] = useState(false);

  async function fetchAll() {
    setLoading(true);
    const [{ data: t }, { data: p }] = await Promise.all([
      (supabase as any).from("technicians").select("*").order("tech_name"),
      (supabase as any).from("profiles").select("id, display_name, email").order("display_name"),
    ]);
    setTechnicians((t as Technician[]) || []);
    setProfiles((p as ProfileLite[]) || []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function deleteTechnician(id: string) {
    if (!confirm("Are you sure you want to delete this technician?")) return;
    await supabase.from("technicians").delete().eq("id", id);
    fetchAll();
  }

  const profileLabel = (uid: string | null) => {
    if (!uid) return "—";
    const p = profiles.find((x) => x.id === uid);
    return p ? (p.display_name || p.email || uid.slice(0, 8)) : "—";
  };

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
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">Technicians</h1>
              <p className="hidden sm:block text-sm text-muted-foreground mt-0.5">Manage technicians, linked users, pincodes, and revenue percentages</p>
            </div>
          </div>
          <TechnicianDialog profiles={profiles} onSaved={fetchAll} />
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">All Technicians</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowPins((v) => !v)}>
              {showPins ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showPins ? "Hide pincodes" : "Show pincodes"}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : technicians.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">No technicians yet</p>
                <p className="text-sm mt-1">Add your first technician to get started.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Tech Name</TableHead>
                      <TableHead>Linked User</TableHead>
                      <TableHead>Pincode</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {technicians.map((tech) => (
                      <TableRow key={tech.id}>
                        <TableCell className="font-medium">{tech.tech_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{profileLabel(tech.user_id)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {tech.pincode ? (showPins ? tech.pincode : "••••••") : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{tech.phone_number || "—"}</TableCell>
                        <TableCell>{tech.city || "—"}</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {tech.percentage != null ? `${tech.percentage}%` : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <TechnicianDialog technician={tech} profiles={profiles} onSaved={fetchAll} />
                            <Button variant="ghost" size="icon" onClick={() => deleteTechnician(tech.id)}>
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

function TechnicianDialog({
  technician,
  profiles,
  onSaved,
}: {
  technician?: Technician;
  profiles: ProfileLite[];
  onSaved: () => void;
}) {
  const isEdit = !!technician;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tech_name: technician?.tech_name || "",
    phone_number: technician?.phone_number || "",
    city: technician?.city || "",
    percentage: technician?.percentage?.toString() || "50",
    user_id: technician?.user_id || "",
    pincode: technician?.pincode || "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function generatePin() {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    update("pincode", pin);
  }

  const profileOptions = useMemo(
    () => profiles.map((p) => ({ id: p.id, label: p.display_name || p.email || p.id.slice(0, 8) })),
    [profiles],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tech_name.trim()) return;
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
      toast.error("Pincode must be exactly 6 digits");
      return;
    }
    setLoading(true);

    const payload = {
      tech_name: form.tech_name,
      phone_number: form.phone_number || null,
      city: form.city || null,
      percentage: form.percentage ? parseFloat(form.percentage) : 50,
      user_id: form.user_id || null,
      pincode: form.pincode || null,
    };

    const { error } = isEdit && technician
      ? await (supabase as any).from("technicians").update(payload).eq("id", technician.id)
      : await (supabase as any).from("technicians").insert(payload);

    setLoading(false);
    if (error) {
      if (error.message?.includes("technicians_pincode_unique")) toast.error("That pincode is already used by another technician");
      else if (error.message?.includes("technicians_user_id_unique")) toast.error("That user is already linked to another technician");
      else toast.error(error.message || "Failed to save");
      return;
    }
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button><Plus className="h-4 w-4 mr-2" /> Add Technician</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Technician" : "Add Technician"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tech Name *</label>
            <Input value={form.tech_name} onChange={(e) => update("tech_name", e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Linked User (role)</label>
            <Select value={form.user_id || "__none__"} onValueChange={(v) => update("user_id", v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {profileOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Roles are managed in Settings → Users.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Remote Pincode (6 digits)</label>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="——————"
                className="font-mono tracking-widest"
              />
              <Button type="button" variant="outline" size="icon" onClick={generatePin} title="Generate new pincode">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Used by the tech on the public upload link to identify themselves.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
              <Input value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Percentage (%)</label>
            <Input type="number" step="0.01" min="0" max="100" value={form.percentage} onChange={(e) => update("percentage", e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Revenue share % for this technician</p>
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
