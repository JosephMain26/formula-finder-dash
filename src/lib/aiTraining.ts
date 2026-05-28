import { supabase } from "@/integrations/supabase/client";

export type MarketerRule = {
  id: string;
  // If a parsed company/customer/notes contains any of these patterns
  // (case-insensitive substring), set marketer = marketerName.
  patterns: string[];
  marketerName: string;
};

export type Correction = {
  id: string;
  at: string; // ISO timestamp
  field: "company" | "tech_name" | "job_type" | "payment" | string;
  parsed: string;
  corrected: string;
  // Source snippet (first ~120 chars of original message) for context
  snippet?: string;
};

export type MatchOverride = {
  id: string;
  at: string;
  phone?: string;
  customerNameParsed?: string;
  addressParsed?: string;
  pickedJobId: string | null; // null = user chose "create new"
  suggestedJobId: string | null;
  snippet?: string;
};

export type AITrainingSetting = {
  marketerRules: MarketerRule[];
  generalRules: string;
  corrections: Correction[]; // capped 100
  matchOverrides: MatchOverride[]; // capped 50
};

const KEY = "ai_training";

export const emptyTraining: AITrainingSetting = {
  marketerRules: [],
  generalRules: "",
  corrections: [],
  matchOverrides: [],
};


function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export async function loadAITraining(): Promise<AITrainingSetting> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  const v = data?.value || {};
  return {
    marketerRules: Array.isArray(v.marketerRules) ? v.marketerRules : [],
    generalRules: typeof v.generalRules === "string" ? v.generalRules : "",
    corrections: Array.isArray(v.corrections) ? v.corrections : [],
  };
}

export async function saveAITraining(t: AITrainingSetting) {
  await (supabase as any).from("app_settings").upsert({
    key: KEY,
    value: t,
    updated_at: new Date().toISOString(),
  });
}

export function newMarketerRule(): MarketerRule {
  return { id: uid(), patterns: [], marketerName: "" };
}

// Apply marketer rules locally to a parsed result.
// Looks at company, customer_name and notes/snippet for any pattern match.
export function applyMarketerRules(
  parsed: { company?: string; customer_name?: string; notes?: string },
  rawMessage: string,
  rules: MarketerRule[]
): string | null {
  const haystack = [
    parsed.company || "",
    parsed.customer_name || "",
    parsed.notes || "",
    rawMessage || "",
  ]
    .join(" \n ")
    .toLowerCase();
  for (const r of rules) {
    if (!r.marketerName) continue;
    for (const p of r.patterns) {
      const needle = p.trim().toLowerCase();
      if (needle && haystack.includes(needle)) return r.marketerName;
    }
  }
  return null;
}

export async function recordCorrection(c: Omit<Correction, "id" | "at">) {
  const t = await loadAITraining();
  const next: Correction = { id: uid(), at: new Date().toISOString(), ...c };
  const corrections = [next, ...t.corrections].slice(0, 100);
  await saveAITraining({ ...t, corrections });
}
