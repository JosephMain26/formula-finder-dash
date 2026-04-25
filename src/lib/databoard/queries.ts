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

export async function fetchJobsForRange(range: DateRange | null, scope: Scope) {
  let q = (supabase as any).from("jobs").select("*");
  if (range) {
    q = q.gte("job_date", range.from).lte("job_date", range.to);
  }
  if (scope.techName) q = q.eq("tech_name", scope.techName);
  if (scope.marketerName) q = q.eq("company", scope.marketerName);
  const { data, error } = await q.order("job_date", { ascending: false }).limit(2000);
  if (error) throw error;
  return data || [];
}
