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
  structuredRules?: StructuredRule[];
};

const KEY = "ai_training";

export const emptyTraining: AITrainingSetting = {
  marketerRules: [],
  generalRules: "",
  corrections: [],
  matchOverrides: [],
  structuredRules: [],
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
    matchOverrides: Array.isArray(v.matchOverrides) ? v.matchOverrides : [],
    structuredRules: Array.isArray(v.structuredRules) ? v.structuredRules : [],
  };
}

export async function recordMatchOverride(o: Omit<MatchOverride, "id" | "at">) {
  const t = await loadAITraining();
  const next: MatchOverride = { id: uid(), at: new Date().toISOString(), ...o };
  const matchOverrides = [next, ...t.matchOverrides].slice(0, 50);
  await saveAITraining({ ...t, matchOverrides });
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

// ---------------------------------------------------------------------------
// Structured rules: written once (optionally with AI help), then enforced by
// plain code after every parse so the model can never ignore them.
// ---------------------------------------------------------------------------

export type StructuredRule = {
  id: string;
  text: string; // the original plain-English sentence
  enabled: boolean;
  when: { source: string; op: string; value: string };
  then: { field: string; value: string; mode: string };
};

export function newStructuredRule(partial?: Partial<StructuredRule>): StructuredRule {
  return {
    id: uid(),
    text: "",
    enabled: true,
    when: { source: "message", op: "contains", value: "" },
    then: { field: "company", value: "", mode: "set" },
    ...partial,
  } as StructuredRule;
}

/** Repairs partial/legacy rule records so the UI never reads undefined.when/then */
export function normalizeStructuredRule(r: any): StructuredRule {
  return {
    id: typeof r?.id === "string" && r.id ? r.id : uid(),
    text: typeof r?.text === "string" ? r.text : "",
    enabled: r?.enabled !== false,
    when: {
      source: String(r?.when?.source || "message"),
      op: String(r?.when?.op || "contains"),
      value: String(r?.when?.value ?? ""),
    },
    then: {
      field: String(r?.then?.field || "company"),
      value: String(r?.then?.value ?? ""),
      mode: String(r?.then?.mode || "set"),
    },
  };
}

export const RULE_SOURCES = [
  "message",
  "company",
  "customer_name",
  "notes",
  "payment",
  "job_type",
  "tech_name",
  "address",
  "phone_no",
] as const;

export const RULE_TARGET_FIELDS = [
  "company",
  "tech_name",
  "job_type",
  "payment",
  "notes",
  "phone_no",
  "address",
  "customer_name",
  "price",
  "parts",
  "co_parts",
  "office_parts",
] as const;

/**
 * Apply structured rules to a parsed result. Returns the updated object plus
 * the ids of rules that fired (used by the rule tester).
 */
export function applyStructuredRules(
  parsed: Record<string, any>,
  rawMessage: string,
  rules: StructuredRule[] | undefined
): { result: Record<string, any>; fired: string[] } {
  const result = { ...parsed };
  const fired: string[] = [];
  for (const r of rules || []) {
    if (!r?.enabled || !r.then?.field) continue;
    const src =
      r.when.source === "message"
        ? rawMessage || ""
        : String(result[r.when.source] ?? "");
    const hay = src.toLowerCase();
    const needle = (r.when.value || "").trim().toLowerCase();
    let hit = false;
    if (r.when.op === "any") hit = true;
    else if (r.when.op === "equals") hit = !!needle && hay.trim() === needle;
    else hit = !!needle && hay.includes(needle);
    if (!hit) continue;

    const current = result[r.then.field];
    if (r.then.mode === "prefix") {
      result[r.then.field] = `${r.then.value} ${current ?? ""}`.trim();
    } else if (r.then.mode === "append") {
      result[r.then.field] = `${current ?? ""} ${r.then.value}`.trim();
    } else {
      result[r.then.field] = r.then.value;
    }
    fired.push(r.id);
  }
  return { result, fired };
}
