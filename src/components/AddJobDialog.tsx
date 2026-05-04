import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { loadPaymentMethods, type PaymentMethod } from "@/lib/settings";
import { DatePickerField } from "@/components/DatePickerField";
import { useAuth } from "@/lib/auth-context";
import { loadFormSchema, defaultStatusName, type CustomField, type StatusDef, loadStatuses } from "@/lib/jobSchema";
import { DynamicField } from "@/components/DynamicField";
import { getCoreFieldsResolved, type CoreFieldOverride, type CoreFieldKey } from "@/lib/coreFields";

type Company = Tables<"companies">;
type Technician = {
  id: string;
  tech_name: string;
  phone_number: string | null;
  city: string | null;
  percentage: number | null;
};
type JobType = { id: string; name: string };
type Installer = { id: string; name: string };
type Client = { id: string; name: string; phone: string | null; address: string | null };

const emptyForm = {
  job_date: "", company_id: "", technician_id: "", tech_name: "",
  po_number: "", phone_no: "", address: "", comp_type: "", job_type: "",
  status: "Pending", price: "", co_parts: "", office_parts: "", parts: "", payment: "",
  check_no: "", tip: "", cost: "", notes: "", cc_fee: "",
  manual_percentage: "", marketer_percentage: "", created_by: "", maps: "", paid: false,
  installer_id: "", installer_name: "",
  client_id: "",
};

interface JobDialogProps {
  onJobSaved: () => void;
  job?: Tables<"jobs"> | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefill?: Partial<typeof emptyForm> & { _companyName?: string; _techName?: string };
}

export function JobDialog({ onJobSaved, job, trigger, open: controlledOpen, onOpenChange, prefill }: JobDialogProps) {
  const { can, displayName, isAdmin, isManager } = useAuth();
  const canAddForOthers = can("jobs.add_for_others");
  const canSeeMarketerPct = can("marketer.view_percentage");
  const canEditPercentage = can("jobs.edit_percentage");
  const canManageClients = isAdmin || isManager; // techs (role 'user' only) skip client auto-save & picker
  const isEdit = !!job;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setInternalOpen(v); };
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [useManualPercentage, setUseManualPercentage] = useState(false);
  const [useManualMarketerPercentage, setUseManualMarketerPercentage] = useState(false);
  const [newJobType, setNewJobType] = useState("");
  const [editingJobType, setEditingJobType] = useState<JobType | null>(null);
  const [editJobTypeName, setEditJobTypeName] = useState("");
  const [managingJobTypes, setManagingJobTypes] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [marketerTypes, setMarketerTypes] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [coreOverrides, setCoreOverrides] = useState<CoreFieldOverride[] | null>(null);
  const [statuses, setStatuses] = useState<StatusDef[]>([]);
  const [extra, setExtra] = useState<Record<string, any>>({});
  const [clientMode, setClientMode] = useState<"skip" | "link" | "new">("skip");
  const [showNewClientPopup, setShowNewClientPopup] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [newClientForm, setNewClientForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      supabase.from("companies").select("*").order("company_name").then(({ data }) => setCompanies(data || []));
      supabase.from("technicians").select("*").order("tech_name").then(({ data }) => setTechnicians((data as Technician[]) || []));
      (supabase as any).from("installers").select("id,name").order("name").then(({ data }: any) => setInstallers((data as Installer[]) || []));
      if (canManageClients) {
        (supabase as any).from("clients").select("id,name,phone,address").order("name").then(({ data }: any) => setClients((data as Client[]) || []));
      }
      (supabase as any).from("marketer_types").select("name").order("name").then(({ data }: any) => {
        setMarketerTypes(((data as { name: string }[]) || []).map((t) => t.name));
      });
      fetchJobTypes();
      loadPaymentMethods().then((m) => setPaymentMethods(m));
      loadFormSchema().then((s) => { setCustomFields(s.fields); setCoreOverrides(s.core); });
      loadStatuses().then((s) => setStatuses(s));
      const seedExtra = (isEdit && job ? ((job as any).extra_fields || {}) : {}) as Record<string, any>;
      setExtra(seedExtra);

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
          installer_id: (job as any).installer_id || "",
          installer_name: (job as any).installer_name || "",
          client_id: (job as any).client_id || "",
        });
        setUseManualPercentage(!!job.manual_percentage);
        setUseManualMarketerPercentage(false);
      } else {
        const seedStatus = statuses.length ? defaultStatusName(statuses) : "Pending";
        setForm({ ...emptyForm, status: seedStatus, ...(prefill || {}) } as typeof emptyForm);
        setUseManualPercentage(false);
        setUseManualMarketerPercentage(false);
        // Resolve company by name from prefill if id not provided
        if (prefill?._companyName && !prefill.company_id) {
          supabase.from("companies").select("*").then(({ data }) => {
            const match = (data || []).find((c) =>
              c.company_name?.toLowerCase() === prefill._companyName!.toLowerCase()
            );
            if (match) {
              const matchType = Array.isArray(match.company_type)
                ? (match.company_type[0] || "")
                : (match.company_type || "");
              setForm((prev) => ({
                ...prev,
                company_id: match.id,
                comp_type: matchType || prev.comp_type,
                manual_percentage: prev.manual_percentage || (match.percentage?.toString() ?? "50"),
              }));
            }
          });
        }
      }
    }
  }, [open]);

  // When user lacks "jobs.add_for_others", auto-assign technician to themselves on new jobs
  useEffect(() => {
    if (canAddForOthers || isEdit || !open || technicians.length === 0) return;
    if (form.technician_id) return;
    const myName = (displayName || "").trim().toLowerCase();
    if (!myName) return;
    const me = technicians.find((t) => (t.tech_name || "").trim().toLowerCase() === myName);
    if (me) {
      setForm((prev) => ({
        ...prev,
        technician_id: me.id,
        tech_name: me.tech_name,
        manual_percentage: useManualPercentage ? prev.manual_percentage : (me.percentage ?? 50).toString(),
      }));
    }
  }, [canAddForOthers, isEdit, open, technicians, displayName]);

  async function fetchJobTypes() {
    const { data } = await supabase.from("job_types").select("*").order("name");
    setJobTypes((data as JobType[]) || []);
  }

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function feePercentFor(methodName: string): number {
    const m = paymentMethods.find((p) => p.name === methodName);
    return typeof m?.feePercent === "number" ? m.feePercent : 0;
  }

  function handleCompanyChange(companyId: string) {
    const company = companies.find(c => c.id === companyId);
    const firstType = Array.isArray(company?.company_type)
      ? (company!.company_type[0] || "")
      : (company?.company_type || "");
    setForm((prev) => ({
      ...prev,
      company_id: companyId,
      comp_type: firstType || prev.comp_type,
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
      installer_id: form.installer_id || null,
      installer_name: form.installer_name || null,
      extra_fields: extra || {},
    };

    // Client linking based on clientMode
    if (canManageClients) {
      if (clientMode === "link" && form.client_id) {
        payload.client_id = form.client_id;
      }
      // "new" mode: save job first, then show popup to create client
    }

    let error;
    let insertedJobId: string | null = null;
    if (isEdit && job) {
      ({ error } = await supabase.from("jobs").update(payload).eq("id", job.id));
      insertedJobId = job.id;
    } else {
      const res = await supabase.from("jobs").insert(payload).select("id").single();
      error = res.error;
      insertedJobId = res.data?.id ?? null;
    }

    setLoading(false);
    if (!error) {
      setOpen(false);
      onJobSaved();
      // If "new" client mode, open the new client popup
      if (canManageClients && clientMode === "new" && !isEdit && insertedJobId) {
        setSavedJobId(insertedJobId);
        setNewClientForm({
          name: (form.address?.split(",")[0]?.trim()) || form.phone_no || "",
          phone: form.phone_no || "",
          email: "",
          address: form.address || "",
          notes: "",
        });
        setShowNewClientPopup(true);
      }
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
          {(() => {
            const resolved = getCoreFieldsResolved(coreOverrides);
            const visible = resolved.filter((f) => f.visibleInForm);
            const labelOf = (k: CoreFieldKey) => resolved.find((f) => f.key === k)?.effectiveLabel || k;
            const reqOf = (k: CoreFieldKey) => resolved.find((f) => f.key === k)?.required || false;

            const renderers: Record<CoreFieldKey, () => React.ReactNode> = {
              job_date: () => (
                <div key="job_date">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("job_date")}{reqOf("job_date") ? " *" : ""}</label>
                  <DatePickerField value={form.job_date} onChange={(v) => update("job_date", v)} />
                </div>
              ),
              company_id: () => (
                <div key="company_id">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("company_id")} *</label>
                  <Select value={form.company_id} onValueChange={handleCompanyChange}>
                    <SelectTrigger><SelectValue placeholder="Select marketer" /></SelectTrigger>
                    <SelectContent>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company_name}{canSeeMarketerPct ? ` (${c.percentage}%)` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ),
              tech_percentage_panel: () => canEditPercentage ? (
                <div key="tech_percentage_panel" className="col-span-2 flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
                  <Checkbox id="manual-pct" checked={useManualPercentage} onCheckedChange={(v) => setUseManualPercentage(!!v)} />
                  <label htmlFor="manual-pct" className="text-sm cursor-pointer">Override tech percentage for this job</label>
                  {useManualPercentage ? (
                    <Input type="number" step="0.01" min="0" max="100" className="w-24 ml-auto" placeholder="Tech %" value={form.manual_percentage} onChange={(e) => update("manual_percentage", e.target.value)} />
                  ) : (
                    <span className="ml-auto text-sm text-muted-foreground">Using tech default %</span>
                  )}
                </div>
              ) : null,
              marketer_percentage_panel: () => (canSeeMarketerPct && canEditPercentage) ? (
                <div key="marketer_percentage_panel" className="col-span-2 flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
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
              ) : null,
              technician_id: () => (
                <div key="technician_id">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("technician_id")}{reqOf("technician_id") ? " *" : ""}</label>
                  <Select
                    value={form.technician_id}
                    disabled={!canAddForOthers && !isEdit}
                    onValueChange={(id) => {
                      update("technician_id", id);
                      const tech = technicians.find(t => t.id === id);
                      if (tech) {
                        update("tech_name", tech.tech_name);
                        if (!useManualPercentage) update("manual_percentage", (tech.percentage ?? 50).toString());
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                    <SelectContent>
                      {technicians.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.tech_name} ({t.percentage ?? 50}%)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!canAddForOthers && !isEdit && (
                    <p className="text-[11px] text-muted-foreground mt-1">You can only add jobs assigned to yourself.</p>
                  )}
                </div>
              ),
              po_number: () => (
                <div key="po_number">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("po_number")}{reqOf("po_number") ? " *" : ""}</label>
                  <Input value={form.po_number} required={reqOf("po_number")} onChange={(e) => update("po_number", e.target.value)} />
                </div>
              ),
              phone_no: () => (
                <div key="phone_no">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("phone_no")}{reqOf("phone_no") ? " *" : ""}</label>
                  <Input value={form.phone_no} required={reqOf("phone_no")} onChange={(e) => update("phone_no", e.target.value)} />
                </div>
              ),
              address: () => (
                <div key="address">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("address")}{reqOf("address") ? " *" : ""}</label>
                  <Input value={form.address} required={reqOf("address")} onChange={(e) => update("address", e.target.value)} />
                </div>
              ),
              comp_type: () => (
                <div key="comp_type">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("comp_type")}{reqOf("comp_type") ? " *" : ""}</label>
                  <Select value={form.comp_type || ""} onValueChange={(v) => update("comp_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select comp type" /></SelectTrigger>
                    <SelectContent>
                      {marketerTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      {form.comp_type && !marketerTypes.includes(form.comp_type) && (
                        <SelectItem value={form.comp_type}>{form.comp_type} (missing)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ),
              job_type: () => (
                <div key="job_type">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">{labelOf("job_type")}{reqOf("job_type") ? " *" : ""}</label>
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => setManagingJobTypes(!managingJobTypes)}>
                      {managingJobTypes ? "Done" : "Manage"}
                    </button>
                  </div>
                  <Select value={form.job_type} onValueChange={(v) => update("job_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select job type" /></SelectTrigger>
                    <SelectContent>
                      {jobTypes.map(jt => <SelectItem key={jt.id} value={jt.name}>{jt.name}</SelectItem>)}
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
              ),
              status: () => (
                <div key="status">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("status")}</label>
                  <Select value={form.status} onValueChange={(v) => update("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(statuses.length ? statuses.map(s => s.name) : ["Pending","In Progress","Completed","Cancelled"]).map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ),
              price: () => (
                <div key="price">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("price")} *</label>
                  <Input type="number" step="0.01" required value={form.price} onChange={(e) => {
                    const newPrice = e.target.value;
                    const pct = feePercentFor(form.payment);
                    setForm((prev) => ({
                      ...prev,
                      price: newPrice,
                      cc_fee: pct > 0
                        ? (Math.round((parseFloat(newPrice) || 0) * (pct / 100) * 100) / 100).toString()
                        : prev.cc_fee,
                    }));
                  }} />
                </div>
              ),
              co_parts: () => (
                <div key="co_parts">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("co_parts")}{reqOf("co_parts") ? " *" : ""}</label>
                  <Input type="number" step="0.01" required={reqOf("co_parts")} value={form.co_parts} onChange={(e) => update("co_parts", e.target.value)} />
                </div>
              ),
              office_parts: () => (
                <div key="office_parts">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("office_parts")}{reqOf("office_parts") ? " *" : ""}</label>
                  <Input type="number" step="0.01" required={reqOf("office_parts")} value={form.office_parts} onChange={(e) => update("office_parts", e.target.value)} />
                </div>
              ),
              parts: () => (
                <div key="parts">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("parts")}{reqOf("parts") ? " *" : ""}</label>
                  <Input type="number" step="0.01" required={reqOf("parts")} value={form.parts} onChange={(e) => update("parts", e.target.value)} />
                </div>
              ),
              payment: () => (
                <div key="payment">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("payment")}{reqOf("payment") ? " *" : ""}</label>
                  <Select
                    value={form.payment}
                    onValueChange={(v) => {
                      const pct = feePercentFor(v);
                      const price = parseFloat(form.price) || 0;
                      setForm((prev) => ({
                        ...prev,
                        payment: v,
                        cc_fee: pct > 0
                          ? (Math.round(price * (pct / 100) * 100) / 100).toString()
                          : "0",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={paymentMethods.length ? "Select payment method" : "Add methods in Settings"} />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((m) => (
                        <SelectItem key={m.id} value={m.name}>
                          {m.name}{typeof m.feePercent === "number" && m.feePercent > 0 ? ` (${m.feePercent}% fee)` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ),
              check_no: () => form.payment.toLowerCase().includes("check") ? (
                <div key="check_no">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("check_no")}</label>
                  <Input value={form.check_no} onChange={(e) => update("check_no", e.target.value)} />
                </div>
              ) : null,
              tip: () => (
                <div key="tip">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("tip")}{reqOf("tip") ? " *" : ""}</label>
                  <Input type="number" step="0.01" value={form.tip} onChange={(e) => update("tip", e.target.value)} />
                </div>
              ),
              cost: () => (
                <div key="cost">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("cost")}{reqOf("cost") ? " *" : ""}</label>
                  <Input type="number" step="0.01" value={form.cost} onChange={(e) => update("cost", e.target.value)} />
                </div>
              ),
              cc_fee: () => feePercentFor(form.payment) > 0 ? (
                <div key="cc_fee">
                  <label className="text-xs font-medium text-muted-foreground">
                    {labelOf("cc_fee")} — auto {feePercentFor(form.payment)}%
                  </label>
                  <Input type="number" step="0.01" value={form.cc_fee} onChange={(e) => update("cc_fee", e.target.value)} />
                </div>
              ) : null,
              created_by: () => (
                <div key="created_by">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("created_by")}</label>
                  <Input value={form.created_by} onChange={(e) => update("created_by", e.target.value)} />
                </div>
              ),
              installer: () => (
                <div key="installer">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("installer")}</label>
                  <Select
                    value={form.installer_id || "__none__"}
                    onValueChange={(id) => {
                      if (id === "__none__") {
                        setForm((prev) => ({ ...prev, installer_id: "", installer_name: "" }));
                        return;
                      }
                      const inst = installers.find((i) => i.id === id);
                      setForm((prev) => ({ ...prev, installer_id: id, installer_name: inst?.name || "" }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={installers.length ? "Select installer" : "No installers yet"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {installers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ),
              notes: () => (
                <div key="notes" className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">{labelOf("notes")}{reqOf("notes") ? " *" : ""}</label>
                  <Input value={form.notes} required={reqOf("notes")} onChange={(e) => update("notes", e.target.value)} />
                </div>
              ),
              paid: () => (
                <div key="paid" className="col-span-2 flex items-center gap-3">
                  <Checkbox id="paid-check" checked={form.paid} onCheckedChange={(v) => update("paid", !!v)} />
                  <label htmlFor="paid-check" className="text-sm cursor-pointer">{labelOf("paid")}</label>
                </div>
              ),
            };

            return visible.map((f) => renderers[f.key]?.());
          })()}

          {canManageClients && !isEdit && (
            <div className="col-span-2 mt-2 pt-3 border-t">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Client</label>
              <RadioGroup
                value={clientMode}
                onValueChange={(v) => {
                  setClientMode(v as "skip" | "link" | "new");
                  if (v !== "link") update("client_id", "");
                }}
                className="flex gap-4"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="skip" id="cm-skip" />
                  <label htmlFor="cm-skip" className="text-sm cursor-pointer">Skip</label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="link" id="cm-link" />
                  <label htmlFor="cm-link" className="text-sm cursor-pointer">Link existing</label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="new" id="cm-new" />
                  <label htmlFor="cm-new" className="text-sm cursor-pointer">Add new</label>
                </div>
              </RadioGroup>
              {clientMode === "link" && (
                <Select
                  value={form.client_id || "__none__"}
                  onValueChange={(id) => {
                    if (id === "__none__") { update("client_id", ""); return; }
                    const c = clients.find((x) => x.id === id);
                    if (!c) return;
                    setForm((prev) => ({
                      ...prev,
                      client_id: id,
                      phone_no: prev.phone_no || c.phone || "",
                      address: prev.address || c.address || "",
                    }));
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={clients.length ? "Select existing client" : "No clients yet"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Select —</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.phone ? ` · ${c.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {clientMode === "new" && (
                <p className="text-xs text-muted-foreground mt-2">A popup will appear after saving to fill in client details.</p>
              )}
            </div>
          )}
          {canManageClients && isEdit && (
            <div className="col-span-2 mt-2 pt-3 border-t">
              <label className="text-xs font-medium text-muted-foreground">Linked Client</label>
              <Select
                value={form.client_id || "__none__"}
                onValueChange={(id) => {
                  if (id === "__none__") { update("client_id", ""); return; }
                  const c = clients.find((x) => x.id === id);
                  if (!c) return;
                  setForm((prev) => ({ ...prev, client_id: id }));
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No client linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.phone ? ` · ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {customFields.filter(f => f.visibleInForm).length > 0 && (
            <div className="col-span-2 mt-2 pt-3 border-t">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Custom fields</div>
              <div className="grid grid-cols-2 gap-4">
                {customFields.filter(f => f.visibleInForm).map((f) => (
                  <DynamicField
                    key={f.id}
                    field={f}
                    value={extra[f.key]}
                    onChange={(v) => setExtra((prev) => ({ ...prev, [f.key]: v }))}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : isEdit ? "Save Changes" : "Add Job"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* Post-submit new client popup */}
    <Dialog open={showNewClientPopup} onOpenChange={(o) => { if (!o) { setShowNewClientPopup(false); setSavedJobId(null); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save Client Details</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newClientForm.name.trim()) return;
            const clientPayload = {
              name: newClientForm.name.trim(),
              phone: newClientForm.phone.trim() || null,
              email: newClientForm.email.trim() || null,
              address: newClientForm.address.trim() || null,
              notes: newClientForm.notes.trim() || null,
            };
            const { data: ins, error } = await (supabase as any)
              .from("clients")
              .insert(clientPayload)
              .select("id")
              .single();
            if (error) {
              toast.error(error.message.includes("clients_phone_unique")
                ? "A client with this phone already exists."
                : error.message);
              return;
            }
            if (ins?.id && savedJobId) {
              await supabase.from("jobs").update({ client_id: ins.id } as any).eq("id", savedJobId);
            }
            toast.success("Client saved & linked to job");
            setShowNewClientPopup(false);
            setSavedJobId(null);
            onJobSaved();
          }}
          className="space-y-3 mt-3"
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <Input value={newClientForm.name} onChange={(e) => setNewClientForm((p) => ({ ...p, name: e.target.value }))} required maxLength={120} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <Input value={newClientForm.phone} onChange={(e) => setNewClientForm((p) => ({ ...p, phone: e.target.value }))} maxLength={40} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input type="email" value={newClientForm.email} onChange={(e) => setNewClientForm((p) => ({ ...p, email: e.target.value }))} maxLength={255} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Address</label>
            <Input value={newClientForm.address} onChange={(e) => setNewClientForm((p) => ({ ...p, address: e.target.value }))} maxLength={300} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Input value={newClientForm.notes} onChange={(e) => setNewClientForm((p) => ({ ...p, notes: e.target.value }))} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setShowNewClientPopup(false); setSavedJobId(null); }}>Skip</Button>
            <Button type="submit">Save Client</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>
  );
}

// Keep backward-compatible export
export function AddJobDialog({ onJobAdded }: { onJobAdded: () => void }) {
  return <JobDialog onJobSaved={onJobAdded} />;
}
