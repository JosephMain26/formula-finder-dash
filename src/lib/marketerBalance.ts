import type { Tables } from "@/integrations/supabase/types";
import { isCompleted } from "@/lib/databoard/metrics";
import { filterChargesByRange, type PartsCharge } from "@/lib/partsCharges";
import { getJobPayments, sumCollectedBy } from "@/lib/jobPayments";

type Job = Tables<"jobs">;

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Amount of the customer's payment the marketer is holding for a job.
 *
 * Preferred source: the per-payment list (sum of payments whose recipient is
 * "Marketer"). Falls back to the legacy `marketer_collected` boolean (which
 * meant the marketer held the whole price) when no payments are recorded, so
 * existing jobs keep working unchanged.
 */
function marketerCollectedAmount(job: Job): number {
  const payments = getJobPayments(job);
  if (payments.length > 0) {
    return sumCollectedBy(payments, "Marketer");
  }
  return (job as any).marketer_collected ? num(job.price) : 0;
}

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
  return earned - marketerCollectedAmount(job);
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
  totalPartsCharges: number; // flat fees the marketer owes the office for parts
  partsCharges: PartsCharge[];
  net: number; // positive = office owes marketer, negative = marketer owes office
  rows: MarketerBalanceRow[];
};

/**
 * Group completed jobs (within an optional date range) by marketer and compute
 * the net balance due for each. Date filtering uses job_date (inclusive).
 *
 * Optional `partsCharges` are flat fees the marketer owes the office for parts
 * bought on their behalf; they reduce the marketer's net (office owes less).
 * Charges are filtered to the same date range using charge_date.
 */
export function summarizeByMarketer(
  jobs: Job[],
  fromDate?: string,
  toDate?: string,
  partsCharges: PartsCharge[] = []
): MarketerBalanceSummary[] {
  const inRange = (j: Job) => {
    if (fromDate && (!j.job_date || j.job_date < fromDate)) return false;
    if (toDate && (!j.job_date || j.job_date > toDate)) return false;
    return true;
  };

  const groups = new Map<string, MarketerBalanceSummary>();

  const ensureGroup = (name: string): MarketerBalanceSummary => {
    let g = groups.get(name);
    if (!g) {
      g = {
        marketer: name,
        jobsCount: 0,
        totalEarned: 0,
        totalCollectedByMarketer: 0,
        totalPartsCharges: 0,
        partsCharges: [],
        net: 0,
        rows: [],
      };
      groups.set(name, g);
    }
    return g;
  };

  for (const job of jobs) {
    if (!isCompleted(job)) continue;
    if (!inRange(job)) continue;

    const name = marketerName(job);
    const earned = num((job as any).total_marketer);
    const collectedByMarketer = marketerCollectedAmount(job);
    const net = jobMarketerBalance(job);

    const g = ensureGroup(name);
    g.jobsCount += 1;
    g.totalEarned += earned;
    g.totalCollectedByMarketer += collectedByMarketer;
    g.net += net;
    g.rows.push({ job, earned, collectedByMarketer, net });
  }

  // Fold in parts charges. A charge means the marketer owes the office, so it
  // subtracts from the net. Marketers with only charges still get a group.
  for (const charge of filterChargesByRange(partsCharges, fromDate, toDate)) {
    if (charge.paid) continue; // settled charges don't affect the balance
    const name = (charge.marketer || "—").trim() || "—";
    const g = ensureGroup(name);
    const amt = num(charge.amount);
    g.totalPartsCharges += amt;
    g.net -= amt;
    g.partsCharges.push(charge);
  }

  const out = Array.from(groups.values());
  // Round to cents to avoid float noise.
  for (const g of out) {
    g.totalEarned = Math.round(g.totalEarned * 100) / 100;
    g.totalCollectedByMarketer = Math.round(g.totalCollectedByMarketer * 100) / 100;
    g.totalPartsCharges = Math.round(g.totalPartsCharges * 100) / 100;
    g.net = Math.round(g.net * 100) / 100;
  }
  out.sort((a, b) => a.marketer.localeCompare(b.marketer));
  return out;
}
