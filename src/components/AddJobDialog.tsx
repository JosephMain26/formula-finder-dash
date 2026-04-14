import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;

interface AddJobDialogProps {
  onJobAdded: () => void;
}

export function AddJobDialog({ onJobAdded }: AddJobDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [useManualPercentage, setUseManualPercentage] = useState(false);
  const [form, setForm] = useState({
    job_date: "",
    company_id: "",
    tech_name: "",
    po_number: "",
    phone_no: "",
    address: "",
    comp_type: "",
    job_type: "",
    status: "Pending",
    price: "",
    co_parts: "",
    parts: "",
    payment: "",
    check_no: "",
    tip: "",
    cost: "",
    notes: "",
    cc_fee: "",
    manual_percentage: "",
    created_by: "",
    maps: "",
  });

  useEffect(() => {
    if (open) {
      supabase.from("companies").select("*").order("company_name").then(({ data }) => {
        setCompanies(data || []);
      });
    }
  }, [open]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCompanyChange(companyId: string) {
    update("company_id", companyId);
    if (!useManualPercentage && companyId) {
      const company = companies.find(c => c.id === companyId);
      if (company?.percentage != null) {
        update("manual_percentage", company.percentage.toString());
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const selectedCompany = companies.find(c => c.id === form.company_id);
    const percentage = form.manual_percentage
      ? parseFloat(form.manual_percentage)
      : selectedCompany?.percentage ?? 50;

    const { error } = await supabase.from("jobs").insert({
      job_date: form.job_date || null,
      company_id: form.company_id || null,
      company_1: selectedCompany?.company_name || null,
      tech_name: form.tech_name || null,
      po_number: form.po_number || null,
      phone_no: form.phone_no || null,
      address: form.address || null,
      comp_type: form.comp_type || null,
      job_type: form.job_type || null,
      status: form.status || "Pending",
      price: form.price ? parseFloat(form.price) : 0,
      co_parts: form.co_parts ? parseFloat(form.co_parts) : 0,
      parts: form.parts ? parseFloat(form.parts) : 0,
      payment: form.payment || null,
      check_no: form.check_no || null,
      tip: form.tip ? parseFloat(form.tip) : 0,
      cost: form.cost ? parseFloat(form.cost) : 0,
      notes: form.notes || null,
      cc_fee: form.cc_fee ? parseFloat(form.cc_fee) : 0,
      manual_percentage: percentage,
      created_by: form.created_by || null,
      maps: form.maps || null,
    });
    setLoading(false);
    if (!error) {
      setOpen(false);
      onJobAdded();
      setForm({
        job_date: "", company_id: "", tech_name: "", po_number: "", phone_no: "",
        address: "", comp_type: "", job_type: "", status: "Pending", price: "",
        co_parts: "", parts: "", payment: "", check_no: "", tip: "", cost: "",
        notes: "", cc_fee: "", manual_percentage: "", created_by: "", maps: "",
      });
      setUseManualPercentage(false);
    }
  }

  const selectedCompany = companies.find(c => c.id === form.company_id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Add Job</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Job Date</label>
            <Input type="date" value={form.job_date} onChange={(e) => update("job_date", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Company</label>
            <Select value={form.company_id} onValueChange={handleCompanyChange}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name} ({c.percentage}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
            <Checkbox
              id="manual-pct"
              checked={useManualPercentage}
              onCheckedChange={(v) => setUseManualPercentage(!!v)}
            />
            <label htmlFor="manual-pct" className="text-sm cursor-pointer">
              Override company percentage for this job
            </label>
            {useManualPercentage && (
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="w-24 ml-auto"
                placeholder="%"
                value={form.manual_percentage}
                onChange={(e) => update("manual_percentage", e.target.value)}
              />
            )}
            {!useManualPercentage && selectedCompany && (
              <span className="ml-auto text-sm text-muted-foreground">
                Using {selectedCompany.percentage}% from {selectedCompany.company_name}
              </span>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tech Name</label>
            <Input value={form.tech_name} onChange={(e) => update("tech_name", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">PO Number</label>
            <Input value={form.po_number} onChange={(e) => update("po_number", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <Input value={form.phone_no} onChange={(e) => update("phone_no", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Address</label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Comp Type</label>
            <Input value={form.comp_type} onChange={(e) => update("comp_type", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Job Type</label>
            <Input value={form.job_type} onChange={(e) => update("job_type", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Price ($)</label>
            <Input type="number" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Co Parts ($)</label>
            <Input type="number" step="0.01" value={form.co_parts} onChange={(e) => update("co_parts", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Parts ($)</label>
            <Input type="number" step="0.01" value={form.parts} onChange={(e) => update("parts", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
            <Input value={form.payment} onChange={(e) => update("payment", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Check #</label>
            <Input value={form.check_no} onChange={(e) => update("check_no", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tip ($)</label>
            <Input type="number" step="0.01" value={form.tip} onChange={(e) => update("tip", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cost ($)</label>
            <Input type="number" step="0.01" value={form.cost} onChange={(e) => update("cost", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">CC Fee ($)</label>
            <Input type="number" step="0.01" value={form.cc_fee} onChange={(e) => update("cc_fee", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Created By</label>
            <Input value={form.created_by} onChange={(e) => update("created_by", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Adding..." : "Add Job"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
