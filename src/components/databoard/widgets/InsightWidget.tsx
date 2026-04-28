import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { jobMetric, isCompleted } from "@/lib/databoard/metrics";

type Job = Tables<"jobs">;

export type InsightDimension =
  | "tech_name" | "company" | "job_type" | "status" | "payment"
  | "installer_name" | "city" | "day" | "week" | "month";

export type InsightMetric =
  | "revenue" | "profit" | "count" | "avg_ticket"
  | "tech_pay" | "marketer_pay" | "parts_cost" | "tip";

export type InsightViz = "bar" | "line" | "area" | "pie" | "donut" | "table" | "number";

export interface InsightSettings {
  dimension: InsightDimension;
  metric: InsightMetric;
  viz: InsightViz;
  limit?: number;
  sort?: "desc" | "asc";
  /** When true, only count jobs with status === "Completed". Default false. */
  completedOnly?: boolean;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

function metricValue(j: Job, m: InsightMetric): number {
  switch (m) {
    case "revenue": return Number(j.price || 0);
    case "profit":
      return Number(j.price || 0) - Number(j.cost || 0) - Number(j.parts || 0)
        - Number(j.cc_fee || 0) - Number(j.total_tech || 0) - Number(j.total_marketer || 0);
    case "count": return 1;
    case "avg_ticket": return Number(j.price || 0);
    case "tech_pay": return Number(j.total_tech || 0);
    case "marketer_pay": return Number(j.total_marketer || 0);
    case "parts_cost": return Number(j.parts || 0) + Number(j.office_parts || 0);
    case "tip": return Number(j.tip || 0);
  }
}

function dimKey(j: Job, d: InsightDimension): string {
  if (d === "city") {
    const addr = (j.address || "").trim();
    if (!addr) return "—";
    // crude: take 2nd comma part
    const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[1] || parts[0] || "—";
  }
  if (d === "day" || d === "week" || d === "month") {
    if (!j.job_date) return "—";
    const dt = new Date(j.job_date);
    if (d === "day") return j.job_date;
    if (d === "month") return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    // week: ISO week-ish
    const onejan = new Date(dt.getFullYear(), 0, 1);
    const week = Math.ceil((((dt.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${dt.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  // For "company" dimension, fall back to legacy `company_1` column.
  const v = d === "company" ? ((j as any).company || (j as any).company_1) : (j as any)[d];
  return (v == null || v === "") ? "—" : String(v);
}

function fmt(n: number, m: InsightMetric): string {
  if (m === "count") return n.toLocaleString();
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

interface Props {
  jobs: Job[];
  settings: InsightSettings;
}

export function InsightWidget({ jobs, settings }: Props) {
  const { dimension, metric, viz, limit = 10, sort = "desc", completedOnly = false } = settings;

  const data = useMemo(() => {
    const source = completedOnly
      ? jobs.filter((j) => (j.status || "").toLowerCase() === "completed")
      : jobs;
    const sums = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const j of source) {
      const k = dimKey(j, dimension);
      sums.set(k, (sums.get(k) || 0) + metricValue(j, metric));
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let arr = Array.from(sums.entries()).map(([name, value]) => ({
      name,
      value: metric === "avg_ticket" ? (counts.get(name) ? value / (counts.get(name) || 1) : 0) : value,
    }));
    const isTime = dimension === "day" || dimension === "week" || dimension === "month";
    if (isTime) arr.sort((a, b) => a.name.localeCompare(b.name));
    else arr.sort((a, b) => sort === "asc" ? a.value - b.value : b.value - a.value);
    if (!isTime && limit > 0) arr = arr.slice(0, limit);
    return arr;
  }, [jobs, dimension, metric, sort, limit, completedOnly]);

  if (viz === "number") {
    const total = data.reduce((s, d) => s + d.value, 0);
    const display = metric === "avg_ticket" && data.length ? total / data.length : total;
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{metric.replace("_", " ")}</div>
        <div className="text-3xl font-bold mt-1">{fmt(display, metric)}</div>
        <div className="text-xs text-muted-foreground mt-1">{jobs.length} jobs</div>
      </div>
    );
  }

  if (!data.length) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>;
  }

  if (viz === "table") {
    return (
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left py-1">{dimension.replace("_", " ")}</th>
            <th className="text-right py-1">{metric.replace("_", " ")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.name} className="border-t">
              <td className="py-1.5 truncate">{r.name}</td>
              <td className="py-1.5 text-right font-medium">{fmt(r.value, metric)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (viz === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} className="font-medium">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (viz === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} className="font-medium">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (viz === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} className="font-medium">
          <defs>
            <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#ig)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // pie or donut
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart className="font-medium">
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius="80%"
          innerRadius={viz === "donut" ? "50%" : 0}
          label={(e: any) => e.name}
        >
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
