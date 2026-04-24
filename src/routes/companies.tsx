import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ArrowLeft, Search, X } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { MarketerTypeSelect } from "@/components/MarketerTypeSelect";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;

export const Route = createFileRoute("/companies")({
  component: CompaniesPage,
  head: () => ({
    meta: [
      { title: "Marketers - Jobs Dashboard" },
      { name: "description", content: "Manage marketers and their revenue percentages" },
    ],
  }),
});

function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTypes, setAllTypes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");

  async function fetchCompanies() {
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").order("company_name");
    setCompanies(data || []);
    setLoading(false);
  }

  async function fetchTypes() {
    const { data } = await (supabase as any).from("marketer_types").select("name").order("name");
    setAllTypes(((data as { name: string }[]) || []).map((t) => t.name));
  }

  useEffect(() => { fetchCompanies(); fetchTypes(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (q) {
        const hay = [c.company_name, c.contact_name, c.email].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (typeFilter !== "__all__") {
        const types = Array.isArray(c.company_type) ? c.company_type : [];
        if (!types.includes(typeFilter)) return false;
      }
      return true;
    });
  }, [companies, search, typeFilter]);

  async function deleteCompany(id: string) {
    if (!confirm("Are you sure you want to delete this company?")) return;
    await supabase.from("companies").delete().eq("id", id);
    fetchCompanies();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-3 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <MobileNav className="lg:hidden" />
            <Link to="/" className="hidden lg:inline-flex">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">Marketers</h1>
              <p className="hidden sm:block text-sm text-muted-foreground mt-0.5">Manage marketers and revenue percentages</p>
            </div>
          </div>
          <div className="flex justify-end sm:justify-start">
            <CompanyDialog onSaved={fetchCompanies} />
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Marketers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : companies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium">No marketers yet</p>
                <p className="text-sm mt-1">Add your first marketer to get started.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Marketer Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.company_name}</TableCell>
                        <TableCell>{company.contact_name || "—"}</TableCell>
                        <TableCell>{company.email || "—"}</TableCell>
                        <TableCell>
                          {Array.isArray(company.company_type) && company.company_type.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {company.company_type.map((t) => (
                                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                              ))}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {company.percentage != null ? `${company.percentage}%` : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <CompanyDialog company={company} onSaved={fetchCompanies} />
                            <Button variant="ghost" size="icon" onClick={() => deleteCompany(company.id)}>
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

function CompanyDialog({ company, onSaved }: { company?: Company; onSaved: () => void }) {
  const isEdit = !!company;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{
    company_name: string;
    contact_name: string;
    email: string;
    company_type: string[];
    percentage: string;
  }>({
    company_name: company?.company_name || "",
    contact_name: company?.contact_name || "",
    email: company?.email || "",
    company_type: Array.isArray(company?.company_type) ? company!.company_type : [],
    percentage: company?.percentage?.toString() || "50",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setLoading(true);

    const payload = {
      company_name: form.company_name,
      contact_name: form.contact_name || null,
      email: form.email || null,
      company_type: form.company_type,
      percentage: form.percentage ? parseFloat(form.percentage) : 50,
    };

    if (isEdit && company) {
      await supabase.from("companies").update(payload).eq("id", company.id);
    } else {
      await supabase.from("companies").insert(payload);
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
          <Button><Plus className="h-4 w-4 mr-2" /> Add Marketer</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Marketer" : "Add Marketer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Marketer Name *</label>
            <Input value={form.company_name} onChange={(e) => update("company_name", e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Contact Name</label>
            <Input value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <MarketerTypeSelect
              value={form.company_type}
              onChange={(next) => setForm((prev) => ({ ...prev, company_type: next }))}
            />
            <p className="text-xs text-muted-foreground mt-1">Select one or more types. Create new tags inline.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Marketer Percentage (%)</label>
            <Input type="number" step="0.01" min="0" max="100" value={form.percentage} onChange={(e) => update("percentage", e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Marketer's share of job revenue</p>
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
