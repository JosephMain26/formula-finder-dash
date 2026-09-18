import { supabase } from "@/integrations/supabase/client";

// ---------- Data visibility (global toggle) ----------
const DATA_VISIBILITY_KEY = "data_visibility";

export type DataVisibilitySetting = {
  shareAcrossUsers: boolean;
};

export async function loadDataVisibility(): Promise<DataVisibilitySetting> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", DATA_VISIBILITY_KEY)
    .maybeSingle();
  return { shareAcrossUsers: Boolean(data?.value?.shareAcrossUsers) };
}

export async function saveDataVisibility(s: DataVisibilitySetting) {
  await (supabase as any).from("app_settings").upsert({
    key: DATA_VISIBILITY_KEY,
    value: { shareAcrossUsers: !!s.shareAcrossUsers },
    updated_at: new Date().toISOString(),
  });
}

// ---------- Payment methods ----------
export type PaymentMethod = {
  id: string;
  name: string;
  feePercent?: number; // optional processing fee for this method
};

export type PaymentMethodsSetting = {
  methods: PaymentMethod[];
};

const PAYMENT_METHODS_KEY = "payment_methods";
const LEGACY_PAYMENT_KEY = "payment_options";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export async function loadPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", PAYMENT_METHODS_KEY)
    .maybeSingle();
  if (data?.value?.methods && Array.isArray(data.value.methods)) {
    return data.value.methods as PaymentMethod[];
  }
  // back-compat: read legacy { enabled: string[], ccFeePercent: number }
  const { data: legacy } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", LEGACY_PAYMENT_KEY)
    .maybeSingle();
  const v = legacy?.value;
  if (v && Array.isArray(v.enabled)) {
    return v.enabled.map((name: string) => ({
      id: uid(),
      name,
      feePercent: name.toLowerCase().includes("card") && typeof v.ccFeePercent === "number" ? v.ccFeePercent : undefined,
    }));
  }
  return [];
}

export async function savePaymentMethods(methods: PaymentMethod[]) {
  await (supabase as any).from("app_settings").upsert({
    key: PAYMENT_METHODS_KEY,
    value: { methods },
    updated_at: new Date().toISOString(),
  });
}

export function newPaymentMethod(name = "", feePercent?: number): PaymentMethod {
  return { id: uid(), name, feePercent };
}

// ---------- Templates (dashboard view + export) ----------
export type DashboardViewTemplate = {
  id: string;
  name: string;
  visibleColumns: string[];
};

export type ExportTemplate = {
  id: string;
  name: string;
  columns: string[];
  marketers?: string[]; // empty/undefined = all
  sections: { id: string; enabled: boolean }[]; // ordered
};

// Report Builder page templates store a full ReportSpec snapshot.
export type ReportTemplate = {
  id: string;
  name: string;
  spec: unknown; // ReportSpec from "@/lib/reportSpec"
};

export type TemplatesSetting = {
  dashboardViews: DashboardViewTemplate[];
  exportTemplates: ExportTemplate[];
  reportTemplates?: ReportTemplate[];
};


const TEMPLATES_KEY = "templates";

export async function loadTemplates(): Promise<TemplatesSetting> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", TEMPLATES_KEY)
    .maybeSingle();
  const v = data?.value || {};
  return {
    dashboardViews: Array.isArray(v.dashboardViews) ? v.dashboardViews : [],
    exportTemplates: Array.isArray(v.exportTemplates) ? v.exportTemplates : [],
    reportTemplates: Array.isArray(v.reportTemplates) ? v.reportTemplates : [],
  };
}


export async function saveTemplates(t: TemplatesSetting) {
  await (supabase as any).from("app_settings").upsert({
    key: TEMPLATES_KEY,
    value: t,
    updated_at: new Date().toISOString(),
  });
}

export function makeId() {
  return uid();
}

// ---------- Billing note/terms templates ----------
export type BillingTemplate = {
  id: string;
  name: string;
  kind: "notes" | "terms";
  appliesTo: "both" | "estimate" | "invoice";
  body: string;
  isDefault?: boolean;
};

const BILLING_TEMPLATES_KEY = "billing_templates";

export async function loadBillingTemplates(): Promise<BillingTemplate[]> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", BILLING_TEMPLATES_KEY)
    .maybeSingle();
  const list = data?.value?.templates;
  return Array.isArray(list) ? (list as BillingTemplate[]) : [];
}

export async function saveBillingTemplates(templates: BillingTemplate[]) {
  await (supabase as any).from("app_settings").upsert({
    key: BILLING_TEMPLATES_KEY,
    value: { templates },
    updated_at: new Date().toISOString(),
  });
}

export function newBillingTemplate(kind: "notes" | "terms"): BillingTemplate {
  return { id: uid(), name: kind === "notes" ? "New note template" : "New terms template", kind, appliesTo: "both", body: "" };
}

// ---------- Technician report templates ----------
export type TechReportTemplateSpec = {
  tech: string;              // "__all__" or a technician name
  dateMode: string;
  dateFrom: string;
  dateTo: string;
  statuses: string[];
  title: string;
  boxes: string[];           // subset of techCut | officeCut | revenue
  columns: string[];         // subset of date | marketer | type | status | price | techCut | officeCut
};

export type TechReportTemplate = { id: string; name: string; spec: TechReportTemplateSpec };

const TECH_REPORT_TEMPLATES_KEY = "tech_report_templates";

export async function loadTechReportTemplates(): Promise<TechReportTemplate[]> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", TECH_REPORT_TEMPLATES_KEY)
    .maybeSingle();
  const list = data?.value?.templates;
  return Array.isArray(list) ? (list as TechReportTemplate[]) : [];
}

export async function saveTechReportTemplates(templates: TechReportTemplate[]) {
  await (supabase as any).from("app_settings").upsert({
    key: TECH_REPORT_TEMPLATES_KEY,
    value: { templates },
    updated_at: new Date().toISOString(),
  });
}

// ---------- Payment collection defaults ----------
export type CollectorRecipient = "Marketer" | "Office" | "Tech";

export type PaymentDefaultsSetting = {
  default: CollectorRecipient;
  byMarketer: Record<string, CollectorRecipient>;
  byTech: Record<string, CollectorRecipient>;
};

const PAYMENT_DEFAULTS_KEY = "payment_defaults";

export const EMPTY_PAYMENT_DEFAULTS: PaymentDefaultsSetting = {
  default: "Office",
  byMarketer: {},
  byTech: {},
};

export async function loadPaymentDefaults(): Promise<PaymentDefaultsSetting> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", PAYMENT_DEFAULTS_KEY)
    .maybeSingle();
  const v = data?.value || {};
  const ok = (r: any): r is CollectorRecipient => r === "Marketer" || r === "Office" || r === "Tech";
  const clean = (o: any): Record<string, CollectorRecipient> => {
    const out: Record<string, CollectorRecipient> = {};
    for (const [k, val] of Object.entries(o || {})) if (k && ok(val)) out[k] = val;
    return out;
  };
  return {
    default: ok(v.default) ? v.default : "Office",
    byMarketer: clean(v.byMarketer),
    byTech: clean(v.byTech),
  };
}

export async function savePaymentDefaults(s: PaymentDefaultsSetting) {
  await (supabase as any).from("app_settings").upsert({
    key: PAYMENT_DEFAULTS_KEY,
    value: s,
    updated_at: new Date().toISOString(),
  });
}
