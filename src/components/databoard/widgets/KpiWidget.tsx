import { useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { jobMetric, isCompleted, sumBy, extraNumber } from "@/lib/databoard/metrics";

type Job = Tables<"jobs">;

function fmt$(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

interface Props {
  jobs: Job[];
  metric:
    | "revenue" | "profit" | "count" | "avg_ticket" | "tech_count"
    | "paid_count" | "tech_pay" | "marketer_pay" | "completed_count"
    | string; // also supports "extra:<key>" for custom numeric fields
  label?: string;
  /** When true, only count jobs whose status === "Completed" (case-insensitive). */
  completedOnly?: boolean;
}

export function KpiWidget({ jobs, metric, label, completedOnly }: Props) {
  const value = useMemo(() => {
    const source = completedOnly ? jobs.filter(isCompleted) : jobs;

    if (typeof metric === "string" && metric.startsWith("extra:")) {
      const key = metric.slice("extra:".length);
      return sumBy(source, (j) => extraNumber(j, key)).toLocaleString();
    }

    switch (metric) {
      case "revenue": return fmt$(sumBy(source, jobMetric.revenue));
      case "profit": return fmt$(sumBy(source, jobMetric.profit));
      case "count": return source.length.toLocaleString();
      case "completed_count": return jobs.filter(isCompleted).length.toLocaleString();
      case "avg_ticket": return fmt$(source.length ? sumBy(source, jobMetric.revenue) / source.length : 0);
      case "tech_count": {
        const set = new Set(source.map((j) => j.tech_name).filter(Boolean));
        return set.size.toLocaleString();
      }
      case "paid_count": return source.filter((j) => j.paid).length.toLocaleString();
      case "tech_pay": return fmt$(sumBy(source, jobMetric.techPay));
      case "marketer_pay": return fmt$(sumBy(source, jobMetric.marketerPay));
      default: return "—";
    }
  }, [jobs, metric, completedOnly]);

  const considered = completedOnly ? jobs.filter(isCompleted).length : jobs.length;

  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label || metric}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">
        {considered} {completedOnly ? "completed" : "jobs"}
      </div>
    </div>
  );
}
