import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";

type Technician = {
  id: string;
  tech_name: string;
  phone_number: string | null;
  city: string | null;
  percentage: number | null;
  created_at: string;
  updated_at: string;
};

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
  const [loading, setLoading] = useState(true);

  async function fetchTechnicians() {
    setLoading(true);
    const { data } = await supabase.from("technicians").select("*").order("tech_name");
    setTechnicians((data as Technician[]) || []);
    setLoading(false);
  }

  useEffect(() => { fetchTechnicians(); }, []);

  async function deleteTechnician(id: string) {
    if (!confirm("Are you sure you want to delete this technician?")) return;
    await supabase.from("technicians").delete().eq("id", id);
    fetchTechnicians();
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
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">Technicians</h1>
              <p className="hidden sm:block text-sm text-muted-foreground mt-0.5">Manage technicians and revenue percentages</p>
            </div>
          </div>
          <TechnicianDialog onSaved={fetchTechnicians} />
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Technicians</CardTitle>
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
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Tech Name</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {technicians.map((tech) => (
                      <TableRow key={tech.id}>
                        <TableCell className="font-medium">{tech.tech_name}</TableCell>
                        <TableCell>{tech.phone_number || "—"}</TableCell>
                        <TableCell>{tech.city || "—"}</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {tech.percentage != null ? `${tech.percentage}%` : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <TechnicianDialog technician={tech} onSaved={fetchTechnicians} />
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

function TechnicianDialog({ technician, onSaved }: { technician?: Technician; onSaved: () => void }) {
  const isEdit = !!technician;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tech_name: technician?.tech_name || "",
    phone_number: technician?.phone_number || "",
    city: technician?.city || "",
    percentage: technician?.percentage?.toString() || "50",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tech_name.trim()) return;
    setLoading(true);

    const payload = {
      tech_name: form.tech_name,
      phone_number: form.phone_number || null,
      city: form.city || null,
      percentage: form.percentage ? parseFloat(form.percentage) : 50,
    };

    if (isEdit && technician) {
      await supabase.from("technicians").update(payload).eq("id", technician.id);
    } else {
      await supabase.from("technicians").insert(payload);
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
            <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
            <Input value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">City</label>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
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
