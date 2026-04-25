import { useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface Props {
  jobs: Job[];
  groupBy: "tech_name" | "company" | "job_type";
  metric: "revenue" | "count";
  limit?: number;
}

export function TableWidget({ jobs, groupBy, metric, limit = 10 }: Props) {
  const rows = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) {
      const k = ((j as any)[groupBy] as string) || "—";
      const v = metric === "count" ? 1 : Number(j.price || 0);
      m.set(k, (m.get(k) || 0) + v);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }, [jobs, groupBy, metric, limit]);

  if (!rows.length) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase text-muted-foreground">
        <tr>
          <th className="text-left py-1">{groupBy.replace("_", " ")}</th>
          <th className="text-right py-1">{metric}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-t">
            <td className="py-1.5 truncate">{k}</td>
            <td className="py-1.5 text-right font-medium">
              {metric === "count" ? v : `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
