import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface Props {
  jobs: Job[];
  variant: "revenue_over_time" | "top_techs" | "top_companies" | "status_breakdown" | "payment_split";
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export function ChartWidget({ jobs, variant }: Props) {
  const data = useMemo(() => {
    if (variant === "revenue_over_time") {
      const m = new Map<string, number>();
      for (const j of jobs) {
        if (!j.job_date) continue;
        m.set(j.job_date, (m.get(j.job_date) || 0) + Number(j.price || 0));
      }
      return Array.from(m.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, value }));
    }
    if (variant === "top_techs" || variant === "top_companies") {
      const key = variant === "top_techs" ? "tech_name" : "company";
      const m = new Map<string, number>();
      for (const j of jobs) {
        const k = (j as any)[key] || "—";
        m.set(k, (m.get(k) || 0) + Number(j.price || 0));
      }
      return Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }));
    }
    if (variant === "status_breakdown") {
      const m = new Map<string, number>();
      for (const j of jobs) m.set(j.status || "—", (m.get(j.status || "—") || 0) + 1);
      return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
    }
    if (variant === "payment_split") {
      const m = new Map<string, number>();
      for (const j of jobs) m.set(j.payment || "—", (m.get(j.payment || "—") || 0) + Number(j.price || 0));
      return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
    }
    return [];
  }, [jobs, variant]);

  if (!data.length) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  }

  if (variant === "revenue_over_time") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="date" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#g)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (variant === "top_techs" || variant === "top_companies") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius="75%" label={(e: any) => e.name}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
