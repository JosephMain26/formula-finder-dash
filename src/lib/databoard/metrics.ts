import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Single source of truth for per-job metric values used across DataBoard widgets,
 * insights, and exports. Each function reads the same DB-backed fields the rest
 * of the app already writes/displays, so the dashboard reflects the true stored
 * values for every job — never a re-derived approximation.
 */
export function isCompleted(j: Job): boolean {
  return (j.status || "").toLowerCase() === "completed";
}

/**
 * Money metrics only count when the job is Completed. Scheduled / pending /
 * cancelled jobs contribute $0 to revenue, profit, tech pay, etc., and the
 * collected deposit (stored separately on `deposit_amount`) is never part of
 * `price`, so it is never double-counted as revenue.
 */
export const jobMetric = {
  revenue: (j: Job) => isCompleted(j) ? num(j.price) : 0,
  /** Office take-home as stored by the app (already net of parts/cc fee/etc). */
  profit: (j: Job) => isCompleted(j) ? num((j as any).total_office) : 0,
  techPay: (j: Job) => isCompleted(j) ? num(j.total_tech) : 0,
  marketerPay: (j: Job) => isCompleted(j) ? num((j as any).total_marketer) : 0,
  partsCost: (j: Job) => isCompleted(j) ? (num(j.parts) + num((j as any).office_parts) + num((j as any).co_parts)) : 0,
  tip: (j: Job) => isCompleted(j) ? num(j.tip) : 0,
  cost: (j: Job) => isCompleted(j) ? num(j.cost) : 0,
  ccFee: (j: Job) => isCompleted(j) ? num(j.cc_fee) : 0,
  /** A job always counts as 1 — never silently filtered. */
  count: (_j: Job) => 1,
};

/** Read a numeric value from a job's custom extra_fields jsonb bag. */
export function extraNumber(j: Job, key: string): number {
  const v = ((j as any).extra_fields || {})[key];
  return num(v);
}

export function sumBy<T>(arr: T[], sel: (x: T) => number): number {
  let s = 0;
  for (const it of arr) s += sel(it);
  return s;
}
