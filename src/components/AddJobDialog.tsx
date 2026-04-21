import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;
type Technician = {
  id: string;
  tech_name: string;
  phone_number: string | null;
  city: string | null;
  percentage: number | null;
};
type JobType = { id: string; name: string };

const emptyForm = {
  job_date: "", company_id: "", technician_id: "", tech_name: "",
  po_number: "", phone_no: "", address: "", comp_type: "", job_type: "",
  status: "Pending", price: "", co_parts: "", office_parts: "", parts: "", payment: "",
  check_no: "", tip: "", cost: "", notes: "", cc_fee: "",
  manual_percentage: "", marketer_percentage: "", created_by: "", maps: "", paid: false,
};

interface JobDialogProps {
  onJobSaved: () => void;
  job?: Tables<"jobs"> | null;
  trigger?: React.ReactNode;
}

export function JobDialog({ onJobSaved, job, trigger }: JobDialogProps) {
  const isEdit = !!job;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [useManualPercentage, setUseManualPercentage] = useState(false);
  const [useManualMarketerPercentage, setUseManualMarketerPercentage] = useState(false);
  const [newJobType, setNewJobType] = useState("");
  const [editingJobType, setEditingJobType] = useState<JobType | null>(null);
  const [editJobTypeName, setEditJobTypeName] = useState("");
  const [managingJobTypes, setManagingJobTypes] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<string[]>([]);
  const [ccFeePercent, setCcFeePercent] = useState(0);

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      supabase.from("companies").select("*").order("company_name").then(({ data }) => setCompanies(data || []));
      supabase.from("technicians").select("*").order("tech_name").then(({ data }) => setTechnicians((data as Technician[]) || []));
      fetchJobTypes();
      (supabase as any).from("app_settings").select("value").eq("key", "payment_options").maybeSingle().then(({ data }: any) => {
        const v = data?.value;
        setPaymentOptions(Array.isArray(v?.enabled) ? v.enabled : []);
        setCcFeePercent(typeof v?.ccFeePercent === "number" ? v.ccFeePercent : 0);
      });

      if (isEdit && job) {
        setForm({
          job_date: job.job_date || "",
          company_id: job.company_id || "",
          technician_id: "",
          tech_name: job.tech_name || "",
          po_number: job.po_number || "",
          phone_no: job.phone_no || "",
          address: job.address || "",
          comp_type: job.comp_type || "",
          job_type: job.job_type || "",
          status: job.status || "Pending",
          price: job.price?.toString() || "",
          co_parts: job.co_parts?.toString() || "",
          office_parts: (job as any).office_parts?.toString() || "",
          parts: job.parts?.toString() || "",
          payment: job.payment || "",
          check_no: job.check_no || "",
          tip: job.tip?.toString() || "",
          cost: job.cost?.toString() || "",
          notes: job.notes || "",
          cc_fee: job.cc_fee?.toString() || "",
          manual_percentage: job.manual_percentage?.toString() || "",
          marketer_percentage: "",
          created_by: job.created_by || "",
          maps: job.maps || "",
          paid: job.paid || false,
        });
        setUseManualPercentage(!!job.manual_percentage);
        setUseManualMarketerPercentage(false);
      } else {
        setForm(emptyForm);
        setUseManualPercentage(false);
        setUseManualMarketerPercentage(false);
      }
    }
  }, [open]);

  async function fetchJobTypes() {
    const { data } = await supabase.from("job_types").select("*").order("name");
    setJobTypes((data as JobType[]) || []);
  }

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleCompanyChange(companyId: string) {
    const company = companies.find(c => c.id === companyId);
    setForm((prev) => ({
      ...prev,
      company_id: companyId,
      comp_type: company?.company_type || prev.comp_type,
      manual_percentage: !useManualPercentage && company?.percentage != null
        ? company.percentage.toString()
        : prev.manual_percentage,
    }));
  }

  async function addJobType() {
    if (!newJobType.trim()) return;
    await supabase.from("job_types").insert({ name: newJobType.trim() } as any);
    setNewJobType("");
    fetchJobTypes();
  }

  async function updateJobType(id: string, name: string) {
    if (!name.trim()) return;
    await supabase.from("job_types").update({ name: name.trim() } as any).eq("id", id);
    setEditingJobType(null);
    fetchJobTypes();
  }

  async function deleteJobType(id: string) {
    await supabase.from("job_types").delete().eq("id", id);
    fetchJobTypes();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const selectedCompany = companies.find(c => c.id === form.company_id);
    const marketerPctRaw = useManualMarketerPercentage && form.marketer_percentage
      ? parseFloat(form.marketer_percentage)
      : (selectedCompany?.percentage ?? 50);
    const techPctRaw = form.manual_percentage ? parseFloat(form.manual_percentage) : 50;

    const price = form.price ? parseFloat(form.price) : 0;
    const coParts = form.co_parts ? parseFloat(form.co_parts) : 0;
    const officeParts = form.office_parts ? parseFloat(form.office_parts) : 0;
    const parts = form.parts ? parseFloat(form.parts) : 0;
    const tip = form.tip ? parseFloat(form.tip) : 0;
    const ccFee = form.cc_fee ? parseFloat(form.cc_fee) : 0;
    const cost = form.cost ? parseFloat(form.cost) : 0;
    const isCard = form.payment?.toLowerCase() === "card" || form.payment?.toLowerCase() === "credit card";

    // Revenue = Price - all parts - Tip (- CC Fee if card)
    const revenue = price - coParts - officeParts - parts - tip - (isCard ? ccFee : 0);
    const marketerPct = marketerPctRaw / 100;
    const techPct = techPctRaw / 100;
    const officePct = Math.max(0, 1 - marketerPct - techPct);

    const totalMarketer = Math.round((revenue * marketerPct + coParts) * 100) / 100;
    const totalOffice = Math.round((revenue * officePct + officeParts) * 100) / 100;
    const totalTech = Math.round((revenue * techPct + parts + tip) * 100) / 100;

    const payload: any = {
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
      price,
      co_parts: coParts,
      office_parts: officeParts,
      parts,
      payment: form.payment || null,
      check_no: form.check_no || null,
      tip,
      cost,
      notes: form.notes || null,
      cc_fee: ccFee,
      manual_percentage: techPctRaw,
      created_by: form.created_by || null,
      maps: form.maps || null,
      paid: form.paid,
      total_tech: totalTech,
      total_office: totalOffice,
      total_marketer: totalMarketer,
    };

    let error;
    if (isEdit && job) {
      ({ error } = await supabase.from("jobs").update(payload).eq("id", job.id));
    } else {
      ({ error } = await supabase.from("jobs").insert(payload));
    }

    setLoading(false);
    if (!error) {
      setOpen(false);
      onJobSaved();
    }
  }

  const selectedCompany = companies.find(c => c.id === form.company_id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button><Plus className="h-4 w-4 mr-2" /> Add Job</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Job" : "Add New Job"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Job Date</label>
            <Input type="date" value={form.job_date} onChange={(e) => update("job_date", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Marketer</label>
            <Select value={form.company_id} onValueChange={handleCompanyChange}>
              <SelectTrigger><SelectValue placeholder="Select marketer" /></SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name} ({c.percentage}%)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
            <Checkbox id="manual-pct" checked={useManualPercentage} onCheckedChange={(v) => setUseManualPercentage(!!v)} />
            <label htmlFor="manual-pct" className="text-sm cursor-pointer">Override tech percentage for this job</label>
            {useManualPercentage && (
              <Input type="number" step="0.01" min="0" max="100" className="w-24 ml-auto" placeholder="Tech %" value={form.manual_percentage} onChange={(e) => update("manual_percentage", e.target.value)} />
            )}
            {!useManualPercentage && (
              <span className="ml-auto text-sm text-muted-foreground">Using tech default %</span>
            )}
          </div>
          <div className="col-span-2 flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
            <Checkbox id="manual-marketer-pct" checked={useManualMarketerPercentage} onCheckedChange={(v) => setUseManualMarketerPercentage(!!v)} />
            <label htmlFor="manual-marketer-pct" className="text-sm cursor-pointer">Override marketer percentage for this job</label>
            {useManualMarketerPercentage ? (
              <Input type="number" step="0.01" min="0" max="100" className="w-24 ml-auto" placeholder="Marketer %" value={form.marketer_percentage} onChange={(e) => update("marketer_percentage", e.target.value)} />
            ) : (
              <span className="ml-auto text-sm text-muted-foreground">
                Using marketer default {selectedCompany?.percentage != null ? `(${selectedCompany.percentage}%)` : "%"}
              </span>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Technician</label>
            <Select value={form.technician_id} onValueChange={(id) => {
              update("technician_id", id);
              const tech = technicians.find(t => t.id === id);
              if (tech) {
                update("tech_name", tech.tech_name);
                if (!useManualPercentage) update("manual_percentage", (tech.percentage ?? 50).toString());
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
              <SelectContent>
                {technicians.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.tech_name} ({t.percentage ?? 50}%)</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Job Type</label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setManagingJobTypes(!managingJobTypes)}>
                {managingJobTypes ? "Done" : "Manage"}
              </button>
            </div>
            <Select value={form.job_type} onValueChange={(v) => update("job_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select job type" /></SelectTrigger>
              <SelectContent>
                {jobTypes.map(jt => (
                  <SelectItem key={jt.id} value={jt.name}>{jt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {managingJobTypes && (
              <div className="mt-2 space-y-2 rounded-lg border p-3 bg-muted/30">
                <div className="flex gap-2">
                  <Input placeholder="New job type" value={newJobType} onChange={(e) => setNewJobType(e.target.value)} className="h-8 text-sm" />
                  <Button type="button" size="sm" variant="outline" onClick={addJobType} className="h-8"><Plus className="h-3 w-3" /></Button>
                </div>
                {jobTypes.map(jt => (
                  <div key={jt.id} className="flex items-center gap-2">
                    {editingJobType?.id === jt.id ? (
                      <>
                        <Input value={editJobTypeName} onChange={(e) => setEditJobTypeName(e.target.value)} className="h-7 text-sm flex-1" />
                        <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => updateJobType(jt.id, editJobTypeName)}>Save</Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingJobType(null)}><X className="h-3 w-3" /></Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm flex-1">{jt.name}</span>
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingJobType(jt); setEditJobTypeName(jt.name); }}><Pencil className="h-3 w-3" /></Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => deleteJobType(jt.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
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
            <Input type="number" step="0.01" value={form.price} onChange={(e) => {
              const newPrice = e.target.value;
              const isCard = form.payment.toLowerCase().includes("card");
              setForm((prev) => ({
                ...prev,
                price: newPrice,
                cc_fee: isCard && ccFeePercent > 0
                  ? (Math.round((parseFloat(newPrice) || 0) * (ccFeePercent / 100) * 100) / 100).toString()
                  : prev.cc_fee,
              }));
            }} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Co Parts ($) — to Marketer</label>
            <Input type="number" step="0.01" value={form.co_parts} onChange={(e) => update("co_parts", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Office Parts ($) — to Office</label>
            <Input type="number" step="0.01" value={form.office_parts} onChange={(e) => update("office_parts", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Parts ($) — to Tech</label>
            <Input type="number" step="0.01" value={form.parts} onChange={(e) => update("parts", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
            <Select
              value={form.payment}
              onValueChange={(v) => {
                const isCard = v.toLowerCase().includes("card");
                const price = parseFloat(form.price) || 0;
                setForm((prev) => ({
                  ...prev,
                  payment: v,
                  cc_fee: isCard && ccFeePercent > 0
                    ? (Math.round(price * (ccFeePercent / 100) * 100) / 100).toString()
                    : "0",
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={paymentOptions.length ? "Select payment method" : "Enable methods in Settings"} />
              </SelectTrigger>
              <SelectContent>
                {paymentOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <label className="text-xs font-medium text-muted-foreground">
              CC Fee ($) {form.payment.toLowerCase().includes("card") && ccFeePercent > 0 && `— auto ${ccFeePercent}%`}
            </label>
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
          <div className="col-span-2 flex items-center gap-3">
            <Checkbox id="paid-check" checked={form.paid} onCheckedChange={(v) => update("paid", !!v)} />
            <label htmlFor="paid-check" className="text-sm cursor-pointer">Paid</label>
          </div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : isEdit ? "Save Changes" : "Add Job"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Keep backward-compatible export
export function AddJobDialog({ onJobAdded }: { onJobAdded: () => void }) {
  return <JobDialog onJobSaved={onJobAdded} />;
}
