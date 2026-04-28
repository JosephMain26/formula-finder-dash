import { supabase } from "@/integrations/supabase/client";
import type { CoreFieldOverride } from "./coreFields";
import { defaultOverrides } from "./coreFields";

// ---------- Types ----------
export type CustomFieldType = "text" | "number" | "select" | "date" | "checkbox" | "textarea";

export type CustomField = {
  id: string;
  key: string;            // stable key inside extra_fields jsonb
  label: string;
  type: CustomFieldType;
  options?: string[];     // for select
  required?: boolean;
  visibleInForm: boolean;
  visibleInTable: boolean;
  visibleInDataboard?: boolean; // numeric only
  default?: string | number | boolean;
};

export type StatusDef = {
  id: string;
  name: string;
  color: StatusColor;
  order: number;
  isDefault?: boolean;
};

export type StatusColor =
  | "gray" | "yellow" | "blue" | "green" | "red" | "purple" | "orange";

export const STATUS_COLORS: Record<StatusColor, string> = {
  gray:   "bg-muted text-muted-foreground hover:bg-muted",
  yellow: "bg-yellow-400 text-black hover:bg-yellow-400",
  blue:   "bg-blue-500 text-white hover:bg-blue-500",
  green:  "bg-green-500 text-white hover:bg-green-500",
  red:    "bg-red-500 text-white hover:bg-red-500",
  purple: "bg-purple-500 text-white hover:bg-purple-500",
  orange: "bg-orange-500 text-white hover:bg-orange-500",
};

// ---------- Defaults ----------
export const DEFAULT_STATUSES: StatusDef[] = [
  { id: "s_pending",  name: "Pending",     color: "yellow", order: 0, isDefault: true },
  { id: "s_progress", name: "In Progress", color: "blue",   order: 1 },
  { id: "s_done",     name: "Completed",   color: "green",  order: 2 },
  { id: "s_cancel",   name: "Cancelled",   color: "red",    order: 3 },
];

// ---------- Storage ----------
const FORM_KEY = "job_form_schema";
const STATUS_KEY = "job_statuses";

function uid() { return Math.random().toString(36).slice(2, 10); }

export function newCustomField(partial?: Partial<CustomField>): CustomField {
  return {
    id: uid(),
    key: partial?.key || `x_${uid()}`,
    label: partial?.label || "New field",
    type: partial?.type || "text",
    options: partial?.options || [],
    required: partial?.required || false,
    visibleInForm: partial?.visibleInForm ?? true,
    visibleInTable: partial?.visibleInTable ?? false,
    visibleInDataboard: partial?.visibleInDataboard ?? false,
    default: partial?.default,
  };
}

export function newStatus(partial?: Partial<StatusDef>): StatusDef {
  return {
    id: uid(),
    name: partial?.name || "New status",
    color: partial?.color || "gray",
    order: partial?.order ?? 99,
    isDefault: partial?.isDefault || false,
  };
}

// ---------- Form schema (custom fields + core overrides) ----------
export type FormSchema = { fields: CustomField[]; core: CoreFieldOverride[] };

export async function loadFormSchema(): Promise<FormSchema> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", FORM_KEY)
    .maybeSingle();
  const v = data?.value;
  const fields = Array.isArray(v?.fields) ? (v.fields as CustomField[]) : [];
  const core = Array.isArray(v?.core) && v.core.length > 0
    ? (v.core as CoreFieldOverride[])
    : defaultOverrides();
  return { fields, core };
}

export async function saveFormSchema(schema: FormSchema) {
  await (supabase as any).from("app_settings").upsert({
    key: FORM_KEY,
    value: { fields: schema.fields, core: schema.core },
    updated_at: new Date().toISOString(),
  });
}

// Backward-compatible helpers used by older callers
export async function loadCustomFields(): Promise<CustomField[]> {
  return (await loadFormSchema()).fields;
}

export async function saveCustomFields(fields: CustomField[]) {
  const cur = await loadFormSchema();
  await saveFormSchema({ fields, core: cur.core });
}

// ---------- Statuses ----------
export async function loadStatuses(): Promise<StatusDef[]> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", STATUS_KEY)
    .maybeSingle();
  const v = data?.value;
  if (Array.isArray(v?.statuses) && v.statuses.length > 0) {
    return (v.statuses as StatusDef[]).slice().sort((a, b) => a.order - b.order);
  }
  return DEFAULT_STATUSES;
}

export async function saveStatuses(statuses: StatusDef[]) {
  await (supabase as any).from("app_settings").upsert({
    key: STATUS_KEY,
    value: { statuses },
    updated_at: new Date().toISOString(),
  });
}

// ---------- Helpers ----------
export function statusBadgeClass(name: string | null | undefined, statuses: StatusDef[]): string {
  if (!name) return STATUS_COLORS.gray;
  const found = statuses.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return STATUS_COLORS[found?.color || "gray"];
}

export function defaultStatusName(statuses: StatusDef[]): string {
  return (statuses.find((s) => s.isDefault) || statuses[0])?.name || "Pending";
}
