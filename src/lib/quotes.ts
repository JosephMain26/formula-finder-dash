import { supabase } from "@/integrations/supabase/client";

export type FollowupEntry = { at: string; note: string; outcome?: string };
type J = { status?: string | null; created_at?: string; extra_fields?: any };

export const QUOTE_STATUS = "Quote";
const CLOSED = ["completed", "cancelled", "canceled"];

export const isOpenJob = (j: J) => !CLOSED.includes((j.status || "").toLowerCase());
export const isQuoteJob = (j: J) => (j.status || "").toLowerCase() === "quote";

export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function addDays(date: string, n: number) {
  const d = new Date(date.slice(0, 10) + "T12:00:00");
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

export const quotedAt = (j: J) => (j.extra_fields?.quoted_at || j.created_at || "").slice(0, 10);

export function nextFollowup(j: J, delayDays: number) {
  return j.extra_fields?.followup_next || (quotedAt(j) ? addDays(quotedAt(j), delayDays) : todayStr());
}

export function followupState(next: string, today = todayStr()): "overdue" | "today" | "upcoming" {
  if (next < today) return "overdue";
  if (next === today) return "today";
  return "upcoming";
}

export function daysSince(date: string, today = todayStr()) {
  if (!date) return 0;
  return Math.round((new Date(today + "T12:00:00").getTime() - new Date(date + "T12:00:00").getTime()) / 86400000);
}

const KEY = "quote_followup_days";
export async function loadFollowupDelay(): Promise<number> {
  const { data } = await (supabase as any).from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const n = Number(data?.value?.days);
  return Number.isFinite(n) && n > 0 ? n : 2;
}
export async function saveFollowupDelay(days: number) {
  await (supabase as any).from("app_settings").upsert({ key: KEY, value: { days }, updated_at: new Date().toISOString() });
}
