import type { Tables } from "@/integrations/supabase/types";
import { Progress } from "@/components/ui/progress";

type Job = Tables<"jobs">;

interface Props {
  jobs: Job[];
  target: number;
  metric?: "revenue" | "count";
  onSetTarget?: () => void;
}

export function GoalWidget({ jobs, target, metric = "revenue" }: Props) {
  const value =
    metric === "count"
      ? jobs.length
      : jobs.reduce((s, j) => s + Number(j.price || 0), 0);
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const fmt = (n: number) =>
    metric === "count" ? n.toString() : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="h-full flex flex-col justify-center gap-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-semibold">{pct.toFixed(0)}%</span>
      </div>
      <Progress value={pct} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{fmt(value)}</span>
        <span>Goal: {fmt(target)}</span>
      </div>
    </div>
  );
}
