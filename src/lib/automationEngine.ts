// Pure, deterministic evaluation of automation conditions and message
// templates. No AI at runtime — shared by the browser and the scheduler.
import type { Tables } from "@/integrations/supabase/types";

export type Job = Tables<"jobs">;

export type Comparator =
  | "eq"
  | "neq"
  | "contains"
  | "gt"
  | "lt"
  | "empty"
  | "not_empty"
  | "is_true"
  | "is_false";

export type Condition = { field: string; op: Comparator; value?: string };

export type TriggerType =
  | "job_created"
  | "job_updated"
  | "field_changed"
  | "time_based"
  | "balance_threshold";

export type Trigger = {
  type: TriggerType;
  /** field_changed */
  field?: string;
  value?: string;
  /** time_based */
  dateField?: "job_date" | "completed_at_date" | "scheduled_completion_date" | "created_at";
  offsetDays?: number; // positive = N days after the date, negative = N days before
  /** balance_threshold */
  balanceOp?: "gt" | "lt";
  balanceAmount?: number;
};

export type ActionType = "set_field" | "send_email" | "send_sms" | "create_alert" | "run_report";

export type Action = {
  type: ActionType;
  /** set_field */
  field?: string;
  value?: string;
  /** messaging */
  to?: "marketer" | "tech" | "client" | "custom";
  address?: string;
  subject?: string;
  body?: string;
  /** run_report */
  reportAutomationId?: string;
};

export type Automation = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  last_run_at: string | null;
};

/** Job fields users can test / set from the automation builder. */
export const JOB_FIELDS: { key: string; label: string; kind: "text" | "number" | "bool" }[] = [
  { key: "status", label: "Status", kind: "text" },
  { key: "job_type", label: "Job type", kind: "text" },
  { key: "company_1", label: "Marketer", kind: "text" },
  { key: "tech_name", label: "Technician", kind: "text" },
  { key: "installer_name", label: "Installer", kind: "text" },
  { key: "payment", label: "Payment method", kind: "text" },
  { key: "price", label: "Price", kind: "number" },
  { key: "parts", label: "Parts", kind: "number" },
  { key: "co_parts", label: "Co-parts", kind: "number" },
  { key: "paid", label: "Paid", kind: "bool" },
  { key: "deposit_received", label: "Deposit received", kind: "bool" },
  { key: "marketer_collected", label: "Marketer collected", kind: "bool" },
  { key: "po_number", label: "PO number", kind: "text" },
  { key: "address", label: "Address", kind: "text" },
  { key: "phone_no", label: "Phone", kind: "text" },
  { key: "notes", label: "Notes", kind: "text" },
  { key: "job_date", label: "Job date", kind: "text" },
  { key: "completed_at_date", label: "Completion date", kind: "text" },
];

export const COMPARATORS: { key: Comparator; label: string; needsValue: boolean }[] = [
  { key: "eq", label: "is", needsValue: true },
  { key: "neq", label: "is not", needsValue: true },
  { key: "contains", label: "contains", needsValue: true },
  { key: "gt", label: "greater than", needsValue: true },
  { key: "lt", label: "less than", needsValue: true },
  { key: "empty", label: "is empty", needsValue: false },
  { key: "not_empty", label: "is not empty", needsValue: false },
  { key: "is_true", label: "is checked", needsValue: false },
  { key: "is_false", label: "is unchecked", needsValue: false },
];

function raw(job: Job, field: string): unknown {
  const v = (job as unknown as Record<string, unknown>)[field];
  if (v !== undefined) return v;
  const extra = (job.extra_fields || {}) as Record<string, unknown>;
  return extra[field];
}

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

export function matchesCondition(job: Job, c: Condition): boolean {
  const v = raw(job, c.field);
  const text = asText(v).trim().toLowerCase();
  const target = (c.value ?? "").trim().toLowerCase();
  switch (c.op) {
    case "eq":
      return text === target;
    case "neq":
      return text !== target;
    case "contains":
      return !!target && text.includes(target);
    case "gt":
      return Number(v ?? 0) > Number(c.value ?? 0);
    case "lt":
      return Number(v ?? 0) < Number(c.value ?? 0);
    case "empty":
      return text === "" || text === "false";
    case "not_empty":
      return text !== "" && text !== "false";
    case "is_true":
      return v === true || text === "true";
    case "is_false":
      return !(v === true || text === "true");
    default:
      return false;
  }
}

export function matchesConditions(job: Job, conditions: Condition[] | null | undefined): boolean {
  return (conditions || []).every((c) => (c?.field ? matchesCondition(job, c) : true));
}

/** Replace {{field}} tokens in a message body with job values. */
export function renderTemplate(text: string, job: Job): string {
  return (text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) =>
    asText(raw(job, key))
  );
}

/** Coerce a builder string value into the right type for a job column. */
export function coerceFieldValue(field: string, value: string): unknown {
  const meta = JOB_FIELDS.find((f) => f.key === field);
  if (meta?.kind === "bool") return value === "true" || value === "yes" || value === "1";
  if (meta?.kind === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return value;
}

/** True when a job_updated / field_changed trigger should fire. */
export function triggerFires(t: Trigger, job: Job, prev: Job | null): boolean {
  if (t.type === "job_created") return prev === null;
  if (t.type === "job_updated") return true;
  if (t.type === "field_changed") {
    if (!t.field) return false;
    const now = asText(raw(job, t.field)).trim().toLowerCase();
    const before = prev ? asText(raw(prev, t.field)).trim().toLowerCase() : "";
    if (prev && now === before) return false;
    const want = (t.value ?? "").trim().toLowerCase();
    return want ? now === want : true;
  }
  return false;
}

/** Days between a job date field and today (positive = date is in the past). */
export function daysSince(job: Job, field: NonNullable<Trigger["dateField"]>, now = new Date()): number | null {
  const v = raw(job, field);
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

export function describeTrigger(t: Trigger): string {
  switch (t?.type) {
    case "job_created":
      return "When a job is created";
    case "job_updated":
      return "When a job is updated";
    case "field_changed":
      return `When ${JOB_FIELDS.find((f) => f.key === t.field)?.label || t.field || "a field"} changes${
        t.value ? ` to "${t.value}"` : ""
      }`;
    case "time_based":
      return `${Math.abs(t.offsetDays ?? 0)} day(s) ${
        (t.offsetDays ?? 0) >= 0 ? "after" : "before"
      } ${t.dateField || "job_date"}`;
    case "balance_threshold":
      return `When a marketer balance is ${t.balanceOp === "lt" ? "below" : "above"} $${t.balanceAmount ?? 0}`;
    default:
      return "—";
  }
}

export function describeAction(a: Action): string {
  switch (a?.type) {
    case "set_field":
      return `Set ${JOB_FIELDS.find((f) => f.key === a.field)?.label || a.field} = ${a.value}`;
    case "send_email":
      return `Email ${a.to === "custom" ? a.address : a.to}`;
    case "send_sms":
      return `SMS ${a.to === "custom" ? a.address : a.to}`;
    case "create_alert":
      return `Create alert "${a.subject || ""}"`;
    case "run_report":
      return "Run a report automation";
    default:
      return "—";
  }
}

export function emptyAutomation(): Omit<Automation, "id" | "last_run_at"> {
  return {
    name: "New automation",
    enabled: true,
    trigger: { type: "job_created" },
    conditions: [],
    actions: [],
  };
}
