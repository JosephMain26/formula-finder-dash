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
export const jobMetric = {
  revenue: (j: Job) => num(j.price),
  /** Office take-home as stored by the app (already net of parts/cc fee/etc). */
  profit: (j: Job) => num((j as any).total_office),
  techPay: (j: Job) => num(j.total_tech),
  marketerPay: (j: Job) => num((j as any).total_marketer),
  partsCost: (j: Job) => num(j.parts) + num((j as any).office_parts) + num((j as any).co_parts),
  tip: (j: Job) => num(j.tip),
  cost: (j: Job) => num(j.cost),
  ccFee: (j: Job) => num(j.cc_fee),
  /** A job always counts as 1 — never silently filtered. */
  count: (_j: Job) => 1,
};

export function isCompleted(j: Job): boolean {
  return (j.status || "").toLowerCase() === "completed";
}

export function sumBy<T>(arr: T[], sel: (x: T) => number): number {
  let s = 0;
  for (const it of arr) s += sel(it);
  return s;
}
