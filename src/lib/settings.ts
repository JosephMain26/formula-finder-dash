import { supabase } from "@/integrations/supabase/client";

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

export type TemplatesSetting = {
  dashboardViews: DashboardViewTemplate[];
  exportTemplates: ExportTemplate[];
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
