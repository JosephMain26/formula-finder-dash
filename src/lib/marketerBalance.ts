import type { Tables } from "@/integrations/supabase/types";
import { isCompleted } from "@/lib/databoard/metrics";
import { filterChargesByRange, type PartsCharge } from "@/lib/partsCharges";

type Job = Tables<"jobs">;

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Net balance contribution of a single job, from the office's perspective.
 *
 *  - Positive  → the office owes the marketer this amount.
 *  - Negative  → the marketer owes the office this amount.
 *
 * Money is only counted for completed jobs (same rule used across the app).
 *
 * Default (office/tech collected the customer's payment):
 *    office owes marketer their earned share  → + total_marketer
 *
 * Marketer collected the full job price:
 *    marketer keeps their share but holds the whole price, so they owe us
 *    everything else                          → total_marketer - price
 */
export function jobMarketerBalance(job: Job): number {
  if (!isCompleted(job)) return 0;
  const earned = num((job as any).total_marketer);
  if ((job as any).marketer_collected) {
    return earned - num(job.price);
  }
  return earned;
}

export function marketerName(job: Job): string {
  return (job.company_1 || job.company || "—").trim() || "—";
}

export type MarketerBalanceRow = {
  job: Job;
  earned: number;
  collectedByMarketer: number; // full price if marketer collected, else 0
  net: number; // office perspective (positive = we owe marketer)
};

export type MarketerBalanceSummary = {
  marketer: string;
  jobsCount: number;
  totalEarned: number;
  totalCollectedByMarketer: number;
  net: number; // positive = office owes marketer, negative = marketer owes office
  rows: MarketerBalanceRow[];
};

/**
 * Group completed jobs (within an optional date range) by marketer and compute
 * the net balance due for each. Date filtering uses job_date (inclusive).
 */
export function summarizeByMarketer(
  jobs: Job[],
  fromDate?: string,
  toDate?: string
): MarketerBalanceSummary[] {
  const inRange = (j: Job) => {
    if (fromDate && (!j.job_date || j.job_date < fromDate)) return false;
    if (toDate && (!j.job_date || j.job_date > toDate)) return false;
    return true;
  };

  const groups = new Map<string, MarketerBalanceSummary>();

  for (const job of jobs) {
    if (!isCompleted(job)) continue;
    if (!inRange(job)) continue;

    const name = marketerName(job);
    const earned = num((job as any).total_marketer);
    const collectedByMarketer = (job as any).marketer_collected ? num(job.price) : 0;
    const net = jobMarketerBalance(job);

    let g = groups.get(name);
    if (!g) {
      g = {
        marketer: name,
        jobsCount: 0,
        totalEarned: 0,
        totalCollectedByMarketer: 0,
        net: 0,
        rows: [],
      };
      groups.set(name, g);
    }
    g.jobsCount += 1;
    g.totalEarned += earned;
    g.totalCollectedByMarketer += collectedByMarketer;
    g.net += net;
    g.rows.push({ job, earned, collectedByMarketer, net });
  }

  const out = Array.from(groups.values());
  // Round to cents to avoid float noise.
  for (const g of out) {
    g.totalEarned = Math.round(g.totalEarned * 100) / 100;
    g.totalCollectedByMarketer = Math.round(g.totalCollectedByMarketer * 100) / 100;
    g.net = Math.round(g.net * 100) / 100;
  }
  out.sort((a, b) => a.marketer.localeCompare(b.marketer));
  return out;
}
