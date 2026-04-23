import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/upload")({
  component: RemoteUploadPage,
  head: () => ({
    meta: [
      { title: "Submit a Job" },
      { name: "description", content: "Submit a new job remotely." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const REMOTE_MARKER = "remote_link";

function RemoteUploadPage() {
  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Submit a Job</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose how you'd like to submit. The team will review and finalize the details.
          </p>
        </div>
        <Tabs defaultValue="parse" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="parse"><Sparkles className="h-4 w-4 mr-2" /> Parse Message</TabsTrigger>
            <TabsTrigger value="manual"><Plus className="h-4 w-4 mr-2" /> Manual Entry</TabsTrigger>
          </TabsList>
          <TabsContent value="parse" className="mt-4">
            <ParseTab />
          </TabsContent>
          <TabsContent value="manual" className="mt-4">
            <ManualTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SuccessCard({ onAnother }: { onAnother: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-center space-y-3">
      <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
      <h2 className="text-lg font-semibold">Job submitted</h2>
      <p className="text-sm text-muted-foreground">Thanks! The team has been notified.</p>
      <Button variant="outline" onClick={onAnother}>Submit another</Button>
    </div>
  );
}

type DraftForm = {
  job_date: string;
  company_1: string;
  company_id: string | null;
  tech_name: string;
  phone_no: string;
  address: string;
  job_type: string;
  price: string;
  parts: string;
  co_parts: string;
  office_parts: string;
  payment: string;
  notes: string;
};

const emptyDraft: DraftForm = {
  job_date: "", company_1: "", company_id: null, tech_name: "", phone_no: "",
  address: "", job_type: "", price: "", parts: "", co_parts: "", office_parts: "",
  payment: "", notes: "",
};

function ParseTab() {
  const [message, setMessage] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);

  function updateDraft(k: keyof DraftForm, v: string) {
    setDraft((p) => ({ ...p, [k]: v }));
  }

  async function parse() {
    const trimmed = message.trim();
    if (!trimmed) { toast.error("Please paste a message first"); return; }
    if (trimmed.length > 5000) { toast.error("Message too long (max 5000 chars)"); return; }
    setParsing(true);
    try {
      const [companiesRes, techsRes, jobTypesRes] = await Promise.all([
        supabase.from("companies").select("id, company_name"),
        supabase.from("technicians").select("tech_name"),
        supabase.from("job_types").select("name"),
      ]);
      const { data, error } = await supabase.functions.invoke("parse-job-message", {
        body: {
          message: trimmed,
          companies: (companiesRes.data || []).map((c: any) => c.company_name),
          technicians: (techsRes.data || []).map((t) => t.tech_name),
          jobTypes: (jobTypesRes.data || []).map((j) => j.name),
        },
      });
      if (error) {
        toast.error("Could not parse message. Try again or use Manual Entry.");
        return;
      }
      const ex = data?.extracted || {};
      const noteParts: string[] = [];
      if (ex.customer_name) noteParts.push(`Customer: ${ex.customer_name}`);
      if (ex.notes) noteParts.push(ex.notes);

      let company_id: string | null = null;
      let company_1 = ex.company || "";
      if (ex.company) {
        const match = (companiesRes.data || []).find(
          (c: any) => c.company_name?.toLowerCase() === String(ex.company).toLowerCase()
        );
        if (match) { company_id = (match as any).id; company_1 = (match as any).company_name; }
      }

      setDraft({
        job_date: ex.job_date || "",
        company_1,
        company_id,
        tech_name: ex.tech_name || "",
        phone_no: ex.phone_no || "",
        address: ex.address || "",
        job_type: ex.job_type || "",
        price: ex.price != null ? String(ex.price) : "",
        parts: ex.parts != null ? String(ex.parts) : "",
        co_parts: ex.co_parts != null ? String(ex.co_parts) : "",
        office_parts: ex.office_parts != null ? String(ex.office_parts) : "",
        payment: ex.payment || "",
        notes: noteParts.join(" • "),
      });
      setReviewOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Failed to parse");
    } finally {
      setParsing(false);
    }
  }

  async function confirmSubmit() {
    setSubmitting(true);
    try {
      const payload: any = {
        job_date: draft.job_date || null,
        company_id: draft.company_id,
        company_1: draft.company_1 || null,
        tech_name: draft.tech_name || null,
        phone_no: draft.phone_no || null,
        address: draft.address || null,
        job_type: draft.job_type || null,
        status: "Pending",
        price: draft.price ? parseFloat(draft.price) : 0,
        parts: draft.parts ? parseFloat(draft.parts) : 0,
        co_parts: draft.co_parts ? parseFloat(draft.co_parts) : 0,
        office_parts: draft.office_parts ? parseFloat(draft.office_parts) : 0,
        payment: draft.payment || null,
        notes: draft.notes || null,
        created_by: REMOTE_MARKER,
      };
      const { error } = await supabase.from("jobs").insert(payload);
      if (error) { toast.error("Failed to save job"); return; }
      setReviewOpen(false);
      setDone(true);
      setMessage("");
      setDraft(emptyDraft);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <SuccessCard onAnother={() => setDone(false)} />;

  return (
    <>
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Customer: John Smith\nPhone: +1 555-1234\nAddress: 123 Main St\nGarage Door Repair\nClosed 350$\nParts 40$`}
        rows={10}
        maxLength={5000}
        className="font-mono text-sm"
      />
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>{message.length} / 5000</span>
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={loading || !message.trim()}>
          {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Parse & Submit</>)}
        </Button>
      </div>
    </div>
  );
}

function ManualTab() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    job_date: "",
    company_1: "",
    tech_name: "",
    phone_no: "",
    address: "",
    job_type: "",
    price: "",
    parts: "",
    payment: "",
    notes: "",
  });

  function update(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        job_date: form.job_date || null,
        company_1: form.company_1 || null,
        tech_name: form.tech_name || null,
        phone_no: form.phone_no || null,
        address: form.address || null,
        job_type: form.job_type || null,
        status: "Pending",
        price: form.price ? parseFloat(form.price) : 0,
        parts: form.parts ? parseFloat(form.parts) : 0,
        payment: form.payment || null,
        notes: form.notes || null,
        created_by: REMOTE_MARKER,
      };
      const { error } = await supabase.from("jobs").insert(payload);
      if (error) { toast.error("Failed to submit"); return; }
      setDone(true);
      setForm({ job_date: "", company_1: "", tech_name: "", phone_no: "", address: "", job_type: "", price: "", parts: "", payment: "", notes: "" });
    } finally {
      setLoading(false);
    }
  }

  if (done) return <SuccessCard onAnother={() => setDone(false)} />;

  return (
    <form onSubmit={submit} className="rounded-xl border bg-card p-5 grid grid-cols-2 gap-3">
      <Field label="Job Date"><Input type="date" value={form.job_date} onChange={(e) => update("job_date", e.target.value)} /></Field>
      <Field label="Marketer"><Input value={form.company_1} onChange={(e) => update("company_1", e.target.value)} /></Field>
      <Field label="Technician"><Input value={form.tech_name} onChange={(e) => update("tech_name", e.target.value)} /></Field>
      <Field label="Phone"><Input value={form.phone_no} onChange={(e) => update("phone_no", e.target.value)} /></Field>
      <Field label="Address" full><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></Field>
      <Field label="Job Type"><Input value={form.job_type} onChange={(e) => update("job_type", e.target.value)} /></Field>
      <Field label="Payment"><Input value={form.payment} onChange={(e) => update("payment", e.target.value)} /></Field>
      <Field label="Price ($)"><Input type="number" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} /></Field>
      <Field label="Parts ($)"><Input type="number" step="0.01" value={form.parts} onChange={(e) => update("parts", e.target.value)} /></Field>
      <Field label="Notes" full><Input value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>) : (<><Plus className="h-4 w-4 mr-2" /> Submit Job</>)}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
