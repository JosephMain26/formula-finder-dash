import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface Props {
  jobs: Job[];
  limit?: number;
}

export function ActivityWidget({ jobs, limit = 20 }: Props) {
  const sorted = [...jobs]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, limit);

  if (!sorted.length) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No activity</div>;
  }

  return (
    <div className="space-y-2 text-sm">
      {sorted.map((j) => (
        <div key={j.id} className="flex justify-between items-start gap-2 border-b pb-1.5 last:border-0">
          <div className="min-w-0">
            <div className="font-medium truncate">{j.tech_name || "—"} · {j.job_type || "—"}</div>
            <div className="text-xs text-muted-foreground truncate">
              {j.company || "—"} · {j.job_date || "—"}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold">${Number(j.price || 0).toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">{j.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
