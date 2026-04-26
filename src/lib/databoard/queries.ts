import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/components/DateRangePresets";

export type Scope = {
  techName?: string | null; // when set, restrict to this tech
  marketerName?: string | null; // when set, restrict to this marketer/company
};

export async function resolveUserScope(opts: {
  userId: string | null | undefined;
  canViewAll: boolean;
}): Promise<Scope> {
  if (opts.canViewAll || !opts.userId) return {};
  // try resolve technician
  const { data: t } = await (supabase as any)
    .from("technicians")
    .select("tech_name")
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (t?.tech_name) return { techName: t.tech_name };
  return {};
}

export type FetchResult = {
  jobs: any[];
  /** Jobs where job_date is null and therefore can't be matched against a date range. */
  undatedCount: number;
};

export async function fetchJobsForRange(range: DateRange | null, scope: Scope): Promise<FetchResult> {
  // Fetch in two passes: in-range + undated (to surface them in UI).
  let inRangeQ = (supabase as any).from("jobs").select("*");
  if (range) inRangeQ = inRangeQ.gte("job_date", range.from).lte("job_date", range.to);
  if (scope.techName) inRangeQ = inRangeQ.eq("tech_name", scope.techName);
  if (scope.marketerName) {
    // Marketer name lives in either `company` or legacy `company_1`.
    inRangeQ = inRangeQ.or(`company.eq.${scope.marketerName},company_1.eq.${scope.marketerName}`);
  }
  const { data, error } = await inRangeQ.order("job_date", { ascending: false }).limit(2000);
  if (error) throw error;

  // Count undated jobs separately so the UI can hint about them.
  let undatedCount = 0;
  if (range) {
    let undatedQ = (supabase as any).from("jobs").select("id", { count: "exact", head: true }).is("job_date", null);
    if (scope.techName) undatedQ = undatedQ.eq("tech_name", scope.techName);
    if (scope.marketerName) undatedQ = undatedQ.or(`company.eq.${scope.marketerName},company_1.eq.${scope.marketerName}`);
    const { count } = await undatedQ;
    undatedCount = count || 0;
  }

  // Coalesce `company` ← `company_1` so the rest of the app only needs to read `company`.
  const jobs = (data || []).map((j: any) => ({
    ...j,
    company: j.company || j.company_1 || null,
  }));

  return { jobs, undatedCount };
}
