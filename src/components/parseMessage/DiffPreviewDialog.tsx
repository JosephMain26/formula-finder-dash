import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { recordCorrection } from "@/lib/aiTraining";
import { computeJobTotals } from "@/lib/jobCalc";
import type { JobLite } from "@/lib/jobMatching";

type Parsed = {
  customer_name?: string;
  phone_no?: string;
  address?: string;
  job_type?: string;
  price?: string;
  parts?: string;
  co_parts?: string;
  office_parts?: string;
  payment?: string;
  tech_name?: string;
  notes?: string;
  _companyName?: string;
};

type FieldKey =
  | "phone_no"
  | "address"
  | "job_type"
  | "tech_name"
  | "payment"
  | "price"
  | "parts"
  | "co_parts"
  | "office_parts"
  | "notes"
  | "status";

const FIELD_LABELS: Record<FieldKey, string> = {
  phone_no: "Phone",
  address: "Address",
  job_type: "Job type",
  tech_name: "Technician",
  payment: "Payment",
  price: "Price",
  parts: "Parts",
  co_parts: "Co-parts",
  office_parts: "Office parts",
  notes: "Notes (append)",
  status: "Status",
};

const NUMERIC_FIELDS = new Set<FieldKey>(["price", "parts", "co_parts", "office_parts"]);

function fmt(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

export function DiffPreviewDialog({
  open,
  onOpenChange,
  job,
  parsed,
  snippet,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  job: JobLite;
  parsed: Parsed;
  snippet: string;
  onApplied: () => void;
}) {
  // Build proposed values
  const todayISO = new Date().toISOString().slice(0, 10);
  const appendedNotes =
    parsed.notes
      ? `${job.notes ? job.notes + "\n" : ""}--- Closing ${todayISO} ---\n${parsed.notes}`
      : (job.notes ?? "");

  const suggestedStatus =
    parsed.price && (!job.status || job.status === "Pending" || job.status === "Scheduled")
      ? "Completed"
      : (job.status ?? "");

  const initial: Record<FieldKey, string> = {
    phone_no: fmt(parsed.phone_no || job.phone_no),
    address: fmt(parsed.address || job.address),
    job_type: fmt(parsed.job_type || job.job_type),
    tech_name: fmt(parsed.tech_name || job.tech_name),
    payment: fmt(parsed.payment || job.payment),
    price: fmt(parsed.price || job.price),
    parts: fmt(parsed.parts || job.parts),
    co_parts: fmt(parsed.co_parts || job.co_parts),
    office_parts: fmt(parsed.office_parts || job.office_parts),
    notes: appendedNotes,
    status: suggestedStatus,
  };

  const current: Record<FieldKey, string> = {
    phone_no: fmt(job.phone_no),
    address: fmt(job.address),
    job_type: fmt(job.job_type),
    tech_name: fmt(job.tech_name),
    payment: fmt(job.payment),
    price: fmt(job.price),
    parts: fmt(job.parts),
    co_parts: fmt(job.co_parts),
    office_parts: fmt(job.office_parts),
    notes: fmt(job.notes),
    status: fmt(job.status),
  };

  const [values, setValues] = useState<Record<FieldKey, string>>(initial);
  const [enabled, setEnabled] = useState<Record<FieldKey, boolean>>(() => {
    const out: Record<FieldKey, boolean> = {} as any;
    (Object.keys(initial) as FieldKey[]).forEach((k) => {
      out[k] = initial[k] !== current[k] && initial[k] !== "";
    });
    return out;
  });
  const [saving, setSaving] = useState(false);

  // Reset when job/parsed changes
  useEffect(() => {
    setValues(initial);
    const out: Record<FieldKey, boolean> = {} as any;
    (Object.keys(initial) as FieldKey[]).forEach((k) => {
      out[k] = initial[k] !== current[k] && initial[k] !== "";
    });
    setEnabled(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  async function handleApply() {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      (Object.keys(values) as FieldKey[]).forEach((k) => {
        if (!enabled[k]) return;
        const v = values[k];
        if (NUMERIC_FIELDS.has(k)) {
          payload[k] = v === "" ? 0 : parseFloat(v);
        } else {
          payload[k] = v === "" ? null : v;
        }
      });

      // Recompute totals if any monetary/status-relevant field changed
      const moneyFieldsTouched = ["price", "parts", "co_parts", "office_parts", "payment"]
        .some((k) => enabled[k as FieldKey]);
      if (moneyFieldsTouched) {
        // Fetch full job for accurate pay-mode/percentages
        const { data: full } = await supabase
          .from("jobs")
          .select("*")
          .eq("id", job.id)
          .maybeSingle();
        if (full) {
          const merged = { ...full, ...payload };
          const totals = computeJobTotals({
            price: merged.price === null || merged.price === undefined ? null : Number(merged.price),
            co_parts: Number(merged.co_parts || 0),
            office_parts: Number(merged.office_parts || 0),
            parts: Number(merged.parts || 0),
            tip: Number(merged.tip || 0),
            cc_fee: Number(merged.cc_fee || 0),
            payment: merged.payment,
            marketer_pct: Number(full.manual_percentage ?? 50),
            tech_pct: Number(full.manual_percentage ?? 50),
            marketer_pay_mode: (full.marketer_pay_mode as any) || "percent",
            marketer_fixed_amount: Number(full.marketer_fixed_amount || 0),
            tech_pay_mode: (full.tech_pay_mode as any) || "percent",
            tech_fixed_amount: Number(full.tech_fixed_amount || 0),
            office_pay_mode: (full.office_pay_mode as any) || "percent",
            office_fixed_amount: Number(full.office_fixed_amount || 0),
          });
          Object.assign(payload, totals);
        }
      }

      // If status flips to Completed, set completed_at_date
      if (enabled.status && values.status === "Completed" && !(job as any).completed_at_date) {
        payload.completed_at_date = new Date().toISOString().slice(0, 10);
      }

      const { error } = await (supabase.from("jobs") as any).update(payload).eq("id", job.id);
      if (error) {
        toast.error("Failed to update job: " + error.message);
        return;
      }

      // Log corrections where user edited the parsed value
      const fieldsToLog: FieldKey[] = ["tech_name", "job_type", "payment"];
      for (const f of fieldsToLog) {
        const parsedVal = (parsed as any)[f] || "";
        if (enabled[f] && parsedVal && values[f] && values[f] !== parsedVal) {
          await recordCorrection({
            field: f === "tech_name" ? "tech_name" : (f as any),
            parsed: parsedVal,
            corrected: values[f],
            snippet: snippet.slice(0, 120),
          });
        }
      }
      // Company correction
      if (parsed._companyName && parsed._companyName !== (job.company_1 || job.company)) {
        // Don't auto-log; user didn't pick a company change here — skip.
      }

      toast.success("Job updated");
      onApplied();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const rows = Object.keys(FIELD_LABELS) as FieldKey[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review updates</DialogTitle>
          <DialogDescription>
            Uncheck rows you don't want to apply, or edit the new value. Notes are appended (not overwritten).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border overflow-hidden">
          <div className="grid grid-cols-[28px_120px_1fr_1fr] gap-2 px-3 py-2 text-xs font-medium bg-muted/50">
            <div></div>
            <div>Field</div>
            <div>Current</div>
            <div>New</div>
          </div>
          <div className="divide-y max-h-[55vh] overflow-y-auto">
            {rows.map((k) => {
              const changed = initial[k] !== current[k];
              return (
                <div key={k} className="grid grid-cols-[28px_120px_1fr_1fr] gap-2 px-3 py-2 items-start">
                  <div className="pt-2">
                    <Checkbox
                      checked={enabled[k]}
                      onCheckedChange={(v) => setEnabled((e) => ({ ...e, [k]: !!v }))}
                    />
                  </div>
                  <div className="text-sm pt-2">
                    {FIELD_LABELS[k]}
                    {changed && <span className="ml-1 text-xs text-primary">●</span>}
                  </div>
                  <div className="text-xs text-muted-foreground pt-2 whitespace-pre-wrap break-words">
                    {current[k] || <span className="italic">empty</span>}
                  </div>
                  <div>
                    {k === "notes" ? (
                      <textarea
                        className="w-full rounded-md border bg-transparent px-2 py-1 text-xs min-h-[80px]"
                        value={values[k]}
                        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                      />
                    ) : (
                      <Input
                        className="h-8 text-xs"
                        value={values[k]}
                        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleApply} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying...</> : "Apply Updates"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
