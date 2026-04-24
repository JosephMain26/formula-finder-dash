import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { loadPaymentMethods, type PaymentMethod } from "@/lib/settings";
import { loadAITraining, applyMarketerRules, recordCorrection } from "@/lib/aiTraining";
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

// ---------- Shared options hook (live data from system) ----------
type Company = { id: string; company_name: string };
type Tech = { id: string; tech_name: string };
type JobType = { id: string; name: string };
type Installer = { id: string; name: string };

type Options = {
  companies: Company[];
  techs: Tech[];
  jobTypes: JobType[];
  installers: Installer[];
  paymentMethods: PaymentMethod[];
  loading: boolean;
};

function useOptions(): Options {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, t, j, i, pm] = await Promise.all([
        supabase.from("companies").select("id, company_name").order("company_name"),
        supabase.from("technicians").select("id, tech_name").order("tech_name"),
        supabase.from("job_types").select("id, name").order("name"),
        (supabase as any).from("installers").select("id, name").order("name"),
        loadPaymentMethods(),
      ]);
      if (cancelled) return;
      setCompanies((c.data as Company[]) || []);
      setTechs((t.data as Tech[]) || []);
      setJobTypes((j.data as JobType[]) || []);
      setInstallers((i.data as Installer[]) || []);
      setPaymentMethods(pm);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { companies, techs, jobTypes, installers, paymentMethods, loading };
}

// Field wrapper
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// Select that picks from a live list of names; passes the chosen name back
function NameSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  // If the current value isn't in the option list (e.g. AI parsed an unknown name), include it
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={options.length ? placeholder : "None configured yet"} />
      </SelectTrigger>
      <SelectContent>
        {all.map((name) => (
          <SelectItem key={name} value={name}>{name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------- Pincode gate ----------
type TechIdentity = { id: string; tech_name: string };

const INACTIVITY_MS = 30_000;

function PincodeStep({ onSuccess }: { onSuccess: (id: TechIdentity) => void }) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "invalid">("idle");

  useEffect(() => {
    if (pin.length !== 6) { setStatus(pin.length === 0 ? "idle" : "checking"); return; }
    let cancelled = false;
    setStatus("checking");
    (async () => {
      const { data, error } = await (supabase as any).rpc("lookup_tech_by_pincode", { _pin: pin });
      if (cancelled) return;
      const row = Array.isArray(data) && data.length ? data[0] : null;
      if (error || !row) { setStatus("invalid"); return; }
      onSuccess({ id: row.id, tech_name: row.tech_name });
    })();
    return () => { cancelled = true; };
  }, [pin]);

  return (
    <div className="rounded-xl border bg-card p-6 space-y-3">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold">Enter your pincode</h2>
        <p className="text-xs text-muted-foreground">Type your personal 6-digit code to continue.</p>
      </div>
      <Input
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="——————"
        className="font-mono tracking-[0.5em] text-center text-2xl h-14"
        autoFocus
      />
      {status === "checking" && <p className="text-xs text-center text-muted-foreground">Checking…</p>}
      {status === "invalid" && <p className="text-xs text-center text-destructive">Pincode not recognized. Ask the office for your code.</p>}
    </div>
  );
}

// ---------- Page ----------
function RemoteUploadPage() {
  const opts = useOptions();
  const [identity, setIdentity] = useState<TechIdentity | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // Inactivity reset: 30s without user interaction sends back to pincode step.
  useEffect(() => {
    if (!identity) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIdentity(null);
        setTimedOut(true);
      }, INACTIVITY_MS);
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [identity]);

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Submit a Job</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The team will review and finalize the details.
          </p>
        </div>
        {!identity ? (
          <>
            {timedOut && (
              <p className="text-xs text-center text-amber-600">Session timed out after 30s of inactivity. Please re-enter your pincode.</p>
            )}
            <PincodeStep onSuccess={(id) => { setIdentity(id); setTimedOut(false); }} />
          </>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm">Welcome, <span className="font-semibold">{identity.tech_name}</span> 👋</p>
                <p className="text-xs text-muted-foreground">Submissions will be tagged with your name.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIdentity(null)}>Sign out</Button>
            </div>
            <Tabs defaultValue="parse" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="parse"><Sparkles className="h-4 w-4 mr-2" /> Parse Message</TabsTrigger>
                <TabsTrigger value="manual"><Plus className="h-4 w-4 mr-2" /> Manual Entry</TabsTrigger>
              </TabsList>
              <TabsContent value="parse" className="mt-4">
                <ParseTab opts={opts} identity={identity} />
              </TabsContent>
              <TabsContent value="manual" className="mt-4">
                <ManualTab opts={opts} identity={identity} />
              </TabsContent>
            </Tabs>
          </>
        )}
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

// ---------- Shared form rendering for both Parse review & Manual ----------
type DraftForm = {
  job_date: string;
  company_1: string;
  company_id: string | null;
  tech_name: string;
  phone_no: string;
  address: string;
  job_type: string;
  installer_name: string;
  installer_id: string | null;
  price: string;
  parts: string;
  co_parts: string;
  office_parts: string;
  payment: string;
  notes: string;
};

const emptyDraft: DraftForm = {
  job_date: "", company_1: "", company_id: null, tech_name: "", phone_no: "",
  address: "", job_type: "", installer_name: "", installer_id: null,
  price: "", parts: "", co_parts: "", office_parts: "",
  payment: "", notes: "",
};

function JobFields({
  draft,
  setDraft,
  opts,
  lockedTechName,
}: {
  draft: DraftForm;
  setDraft: React.Dispatch<React.SetStateAction<DraftForm>>;
  opts: Options;
  lockedTechName?: string | null;
}) {
  function update(k: keyof DraftForm, v: string) { setDraft((p) => ({ ...p, [k]: v })); }

  // If locked, force the tech_name in draft so submission carries it
  useEffect(() => {
    if (lockedTechName && draft.tech_name !== lockedTechName) {
      setDraft((p) => ({ ...p, tech_name: lockedTechName }));
    }
  }, [lockedTechName]);

  function pickCompany(name: string) {
    const c = opts.companies.find((x) => x.company_name === name);
    setDraft((p) => ({ ...p, company_1: name, company_id: c?.id ?? null }));
  }
  function pickInstaller(name: string) {
    const i = opts.installers.find((x) => x.name === name);
    setDraft((p) => ({ ...p, installer_name: name, installer_id: i?.id ?? null }));
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Job Date">
        <Input type="date" value={draft.job_date} onChange={(e) => update("job_date", e.target.value)} />
      </Field>
      <Field label="Marketer">
        <NameSelect
          value={draft.company_1}
          onChange={pickCompany}
          options={opts.companies.map((c) => c.company_name)}
          placeholder="Select marketer"
        />
      </Field>
      <Field label="Technician">
        {lockedTechName ? (
          <Input value={lockedTechName} disabled readOnly className="bg-muted" />
        ) : (
          <NameSelect
            value={draft.tech_name}
            onChange={(v) => update("tech_name", v)}
            options={opts.techs.map((t) => t.tech_name)}
            placeholder="Select technician"
          />
        )}
      </Field>
      <Field label="Phone">
        <Input value={draft.phone_no} onChange={(e) => update("phone_no", e.target.value)} />
      </Field>
      <Field label="Address" full>
        <Input value={draft.address} onChange={(e) => update("address", e.target.value)} />
      </Field>
      <Field label="Job Type">
        <NameSelect
          value={draft.job_type}
          onChange={(v) => update("job_type", v)}
          options={opts.jobTypes.map((j) => j.name)}
          placeholder="Select job type"
        />
      </Field>
      <Field label="Installer (optional)">
        <NameSelect
          value={draft.installer_name}
          onChange={pickInstaller}
          options={opts.installers.map((i) => i.name)}
          placeholder="Select installer"
        />
      </Field>
      <Field label="Payment Method">
        <NameSelect
          value={draft.payment}
          onChange={(v) => update("payment", v)}
          options={opts.paymentMethods.map((m) => m.name)}
          placeholder="Select payment method"
        />
      </Field>
      <Field label="Price ($)">
        <Input type="number" step="0.01" value={draft.price} onChange={(e) => update("price", e.target.value)} />
      </Field>
      <Field label="Parts ($)">
        <Input type="number" step="0.01" value={draft.parts} onChange={(e) => update("parts", e.target.value)} />
      </Field>
      <Field label="Co Parts ($)">
        <Input type="number" step="0.01" value={draft.co_parts} onChange={(e) => update("co_parts", e.target.value)} />
      </Field>
      <Field label="Office Parts ($)">
        <Input type="number" step="0.01" value={draft.office_parts} onChange={(e) => update("office_parts", e.target.value)} />
      </Field>
      <Field label="Notes" full>
        <Textarea rows={3} value={draft.notes} onChange={(e) => update("notes", e.target.value)} />
      </Field>
    </div>
  );
}

function buildPayload(draft: DraftForm, identity: TechIdentity | null) {
  const techName = identity?.tech_name || draft.tech_name || null;
  return {
    job_date: draft.job_date || null,
    company_id: draft.company_id,
    company_1: draft.company_1 || null,
    tech_name: techName,
    phone_no: draft.phone_no || null,
    address: draft.address || null,
    job_type: draft.job_type || null,
    installer_id: draft.installer_id,
    installer_name: draft.installer_name || null,
    status: "Pending",
    price: draft.price ? parseFloat(draft.price) : 0,
    parts: draft.parts ? parseFloat(draft.parts) : 0,
    co_parts: draft.co_parts ? parseFloat(draft.co_parts) : 0,
    office_parts: draft.office_parts ? parseFloat(draft.office_parts) : 0,
    payment: draft.payment || null,
    notes: draft.notes || null,
    created_by: identity ? `remote_link:${identity.tech_name}` : REMOTE_MARKER,
  } as any;
}

// ---------- Parse Tab ----------
function ParseTab({ opts, identity }: { opts: Options; identity: TechIdentity | null }) {
  const [message, setMessage] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);
  const [parsedSnapshot, setParsedSnapshot] = useState<{
    company: string; tech_name: string; job_type: string; payment: string; snippet: string;
  } | null>(null);

  async function parse() {
    const trimmed = message.trim();
    if (!trimmed) { toast.error("Please paste a message first"); return; }
    if (trimmed.length > 5000) { toast.error("Message too long (max 5000 chars)"); return; }
    setParsing(true);
    try {
      const training = await loadAITraining();
      const { data, error } = await supabase.functions.invoke("parse-job-message", {
        body: {
          message: trimmed,
          companies: opts.companies.map((c) => c.company_name),
          technicians: opts.techs.map((t) => t.tech_name),
          jobTypes: opts.jobTypes.map((j) => j.name),
          generalRules: training.generalRules,
          marketerRules: training.marketerRules,
          recentCorrections: training.corrections,
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

      // Apply local marketer rules (override AI guess if a rule matches)
      const ruleMatch = applyMarketerRules(
        { company: ex.company, customer_name: ex.customer_name, notes: ex.notes },
        trimmed,
        training.marketerRules
      );
      const finalCompanyName = ruleMatch || ex.company || "";
      const company = opts.companies.find(
        (c) => c.company_name.toLowerCase() === finalCompanyName.toLowerCase()
      );

      setParsedSnapshot({
        company: finalCompanyName,
        tech_name: ex.tech_name || "",
        job_type: ex.job_type || "",
        payment: ex.payment || "",
        snippet: trimmed.slice(0, 120),
      });

      setDraft({
        job_date: ex.job_date || "",
        company_1: company?.company_name || finalCompanyName,
        company_id: company?.id ?? null,
        tech_name: ex.tech_name || "",
        phone_no: ex.phone_no || "",
        address: ex.address || "",
        job_type: ex.job_type || "",
        installer_name: "",
        installer_id: null,
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
      const { error } = await supabase.from("jobs").insert(buildPayload(draft, identity));
      if (error) { toast.error("Failed to save job"); return; }
      // Auto-learn: record any field the user corrected
      if (parsedSnapshot) {
        const checks: { field: "company" | "tech_name" | "job_type" | "payment"; parsed: string; corrected: string }[] = [
          { field: "company", parsed: parsedSnapshot.company, corrected: draft.company_1 },
          { field: "tech_name", parsed: parsedSnapshot.tech_name, corrected: draft.tech_name },
          { field: "job_type", parsed: parsedSnapshot.job_type, corrected: draft.job_type },
          { field: "payment", parsed: parsedSnapshot.payment, corrected: draft.payment },
        ];
        for (const c of checks) {
          const a = (c.parsed || "").trim().toLowerCase();
          const b = (c.corrected || "").trim().toLowerCase();
          if (b && a !== b) {
            await recordCorrection({ field: c.field, parsed: c.parsed || "", corrected: c.corrected, snippet: parsedSnapshot.snippet });
          }
        }
      }
      setReviewOpen(false);
      setDone(true);
      setMessage("");
      setDraft(emptyDraft);
      setParsedSnapshot(null);
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
          <Button onClick={parse} disabled={parsing || !message.trim() || opts.loading || !identity}>
            {parsing ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing...</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Parse & Review</>)}
          </Button>
        </div>
        {!identity && <p className="text-xs text-muted-foreground text-right">Enter your pincode above to enable submission.</p>}
      </div>

      <Dialog open={reviewOpen} onOpenChange={(o) => { if (!submitting) setReviewOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review & Edit Job Details</DialogTitle>
            <DialogDescription>
              We pre-filled the details from your message. Please review, fix anything, and add any missing info before submitting.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <JobFields draft={draft} setDraft={setDraft} opts={opts} lockedTechName={identity?.tech_name ?? null} />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={submitting}>Back</Button>
            <Button onClick={confirmSubmit} disabled={submitting}>
              {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>) : (<><Plus className="h-4 w-4 mr-2" /> Submit Job</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Manual Tab ----------
function ManualTab({ opts, identity }: { opts: Options; identity: TechIdentity | null }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("jobs").insert(buildPayload(draft, identity));
      if (error) { toast.error("Failed to submit"); return; }
      setDone(true);
      setDraft(emptyDraft);
    } finally {
      setLoading(false);
    }
  }

  if (done) return <SuccessCard onAnother={() => setDone(false)} />;

  return (
    <form onSubmit={submit} className="rounded-xl border bg-card p-5 space-y-3">
      <JobFields draft={draft} setDraft={setDraft} opts={opts} lockedTechName={identity?.tech_name ?? null} />
      <div className="flex justify-end">
        <Button type="submit" disabled={loading || opts.loading || !identity}>
          {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>) : (<><Plus className="h-4 w-4 mr-2" /> Submit Job</>)}
        </Button>
      </div>
      {!identity && <p className="text-xs text-muted-foreground text-right">Enter your pincode above to enable submission.</p>}
    </form>
  );
}
