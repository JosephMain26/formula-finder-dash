import { useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

function fmt$(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

interface Props {
  jobs: Job[];
  metric: "revenue" | "profit" | "count" | "avg_ticket" | "tech_count" | "paid_count" | "tech_pay" | "marketer_pay";
  label?: string;
}

export function KpiWidget({ jobs, metric, label }: Props) {
  const value = useMemo(() => {
    switch (metric) {
      case "revenue":
        return fmt$(jobs.reduce((s, j) => s + Number(j.price || 0), 0));
      case "profit":
        return fmt$(
          jobs.reduce(
            (s, j) =>
              s +
              (Number(j.price || 0) -
                Number(j.cost || 0) -
                Number(j.parts || 0) -
                Number(j.cc_fee || 0) -
                Number(j.total_tech || 0) -
                Number(j.total_marketer || 0)),
            0
          )
        );
      case "count":
        return jobs.length.toLocaleString();
      case "avg_ticket":
        return fmt$(jobs.length ? jobs.reduce((s, j) => s + Number(j.price || 0), 0) / jobs.length : 0);
      case "tech_count": {
        const set = new Set(jobs.map((j) => j.tech_name).filter(Boolean));
        return set.size.toLocaleString();
      }
      case "paid_count":
        return jobs.filter((j) => j.paid).length.toLocaleString();
      case "tech_pay":
        return fmt$(jobs.reduce((s, j) => s + Number(j.total_tech || 0), 0));
      case "marketer_pay":
        return fmt$(jobs.reduce((s, j) => s + Number(j.total_marketer || 0), 0));
    }
  }, [jobs, metric]);

  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label || metric}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{jobs.length} jobs</div>
    </div>
  );
}
