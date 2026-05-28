import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type JobLite = Pick<
  Tables<"jobs">,
  | "id"
  | "job_date"
  | "phone_no"
  | "address"
  | "notes"
  | "tech_name"
  | "company"
  | "company_1"
  | "status"
  | "price"
  | "parts"
  | "co_parts"
  | "office_parts"
  | "payment"
  | "job_type"
  | "created_at"
  | "extra_fields"
>;

export type ParsedFields = {
  phone_no?: string;
  address?: string;
  customer_name?: string;
  notes?: string;
};

export type ScoredMatch = {
  job: JobLite;
  score: number;
  reasons: string[];
};

const STREET_STOPWORDS = new Set([
  "st", "street", "ave", "avenue", "rd", "road", "blvd", "boulevard",
  "dr", "drive", "ln", "lane", "ct", "court", "pl", "place", "way",
  "pkwy", "parkway", "ter", "terrace", "cir", "circle", "hwy", "highway",
  "apt", "apartment", "unit", "ste", "suite", "n", "s", "e", "w",
  "north", "south", "east", "west", "ne", "nw", "se", "sw",
]);

export function normalizePhone(p?: string | null): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  return digits.slice(-10);
}

export function normalizeAddress(a?: string | null): {
  tokens: string[];
  number: string;
} {
  if (!a) return { tokens: [], number: "" };
  const lower = a.toLowerCase().replace(/[,#]/g, " ").replace(/\s+/g, " ").trim();
  const parts = lower.split(" ").filter(Boolean);
  const number = parts.find((p) => /^\d+$/.test(p)) || "";
  const tokens = parts.filter((p) => p && !STREET_STOPWORDS.has(p) && p !== number);
  return { tokens, number };
}

function nameMatchesNotes(name: string, hay: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase().trim();
  if (n.length < 3) return false;
  return hay.toLowerCase().includes(n);
}

export function scoreCandidate(parsed: ParsedFields, job: JobLite): ScoredMatch {
  let score = 0;
  const reasons: string[] = [];

  const pPhone = normalizePhone(parsed.phone_no);
  const jPhone = normalizePhone(job.phone_no);
  if (pPhone && jPhone && pPhone === jPhone) {
    score += 100;
    reasons.push("Phone match");
  }

  const pAddr = normalizeAddress(parsed.address);
  const jAddr = normalizeAddress(job.address);
  if (pAddr.tokens.length && jAddr.tokens.length) {
    const sameNumber = pAddr.number && jAddr.number && pAddr.number === jAddr.number;
    const overlap = pAddr.tokens.filter((t) => jAddr.tokens.includes(t)).length;
    const ratio = overlap / Math.max(pAddr.tokens.length, jAddr.tokens.length);
    if (sameNumber && overlap >= 1) {
      score += 60;
      reasons.push("Address match");
    } else if (ratio >= 0.6) {
      score += 60;
      reasons.push("Address match");
    } else if (ratio >= 0.3 || sameNumber) {
      score += 25;
      reasons.push("Partial address");
    }
  }

  if (parsed.customer_name) {
    const hay = [job.notes || "", JSON.stringify(job.extra_fields || {})].join(" ");
    if (nameMatchesNotes(parsed.customer_name, hay)) {
      score += 40;
      reasons.push("Customer name");
    }
  }

  return { job, score, reasons };
}

export async function fetchCandidateJobs(): Promise<JobLite[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id,job_date,phone_no,address,notes,tech_name,company,company_1,status,price,parts,co_parts,office_parts,payment,job_type,created_at,extra_fields"
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("fetchCandidateJobs", error);
    return [];
  }
  return (data || []) as JobLite[];
}

export function findMatches(
  parsed: ParsedFields,
  candidates: JobLite[],
  minScore = 60,
  topN = 3
): ScoredMatch[] {
  const scored = candidates
    .map((c) => scoreCandidate(parsed, c))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
