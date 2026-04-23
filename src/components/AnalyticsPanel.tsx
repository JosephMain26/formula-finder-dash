import { useMemo, useState, useEffect } from "react";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

type MetricKey =
  | "popular_job"
  | "jobs_per_tech"
  | "revenue_per_day"
  | "jobs_per_marketer"
  | "profit_per_day"
  | "payment_method"
  | "profit_per_tech";

type ChartType = "bar" | "pie" | "line";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "popular_job", label: "Most popular job" },
  { key: "jobs_per_tech", label: "Most jobs / tech" },
  { key: "revenue_per_day", label: "Revenue / day" },
  { key: "jobs_per_marketer", label: "Most jobs / marketer" },
  { key: "profit_per_day", label: "Profit per day" },
  { key: "payment_method", label: "Payment method / jobs" },
  { key: "profit_per_tech", label: "Most profit / tech" },
];

const COLORS = ["hsl(var(--primary))", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

type ChartConfig = { id: string; metric: MetricKey; type: ChartType };

const STORAGE_KEY = "analytics_panel_charts_v1";

function loadCharts(): ChartConfig[] {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaults();
}
function defaults(): ChartConfig[] {
  return [
    { id: "1", metric: "revenue_per_day", type: "line" },
    { id: "2", metric: "popular_job", type: "pie" },
    { id: "3", metric: "jobs_per_tech", type: "bar" },
  ];
}

function aggregate(jobs: Job[], metric: MetricKey): { name: string; value: number }[] {
  const map = new Map<string, number>();
  const profit = (j: Job) =>
    Number(j.price || 0) - Number(j.cost || 0) - Number(j.parts || 0) - Number(j.cc_fee || 0);

  switch (metric) {
    case "popular_job":
      jobs.forEach((j) => { const k = j.job_type || "Unknown"; map.set(k, (map.get(k) || 0) + 1); });
      break;
    case "jobs_per_tech":
      jobs.forEach((j) => { const k = j.tech_name || "Unassigned"; map.set(k, (map.get(k) || 0) + 1); });
      break;
    case "jobs_per_marketer":
      jobs.forEach((j) => { const k = j.company_1 || j.company || "Unknown"; map.set(k, (map.get(k) || 0) + 1); });
      break;
    case "payment_method":
      jobs.forEach((j) => { const k = j.payment || "Unspecified"; map.set(k, (map.get(k) || 0) + 1); });
      break;
    case "revenue_per_day":
      jobs.forEach((j) => {
        if (!j.job_date) return;
        map.set(j.job_date, (map.get(j.job_date) || 0) + Number(j.price || 0));
      });
      return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
    case "profit_per_day":
      jobs.forEach((j) => {
        if (!j.job_date) return;
        map.set(j.job_date, (map.get(j.job_date) || 0) + profit(j));
      });
      return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
    case "profit_per_tech":
      jobs.forEach((j) => { const k = j.tech_name || "Unassigned"; map.set(k, (map.get(k) || 0) + profit(j)); });
      break;
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function ChartCard({
  config, jobs, onChange, onRemove,
}: { config: ChartConfig; jobs: Job[]; onChange: (c: ChartConfig) => void; onRemove: () => void }) {
  const data = useMemo(() => aggregate(jobs, config.metric), [jobs, config.metric]);
  const label = METRICS.find((m) => m.key === config.metric)?.label || "";

  return (
    <div className="bg-card border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Select value={config.metric} onValueChange={(v) => onChange({ ...config, metric: v as MetricKey })}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={config.type} onValueChange={(v) => onChange({ ...config, type: v as ChartType })}>
          <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bar">Bar</SelectItem>
            <SelectItem value="pie">Pie</SelectItem>
            <SelectItem value="line">Line</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}><X className="h-4 w-4" /></Button>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          {config.type === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={60} label={(e) => e.name}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : config.type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS[0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function AnalyticsPanel({ jobs }: { jobs: Job[] }) {
  const [charts, setCharts] = useState<ChartConfig[]>(loadCharts);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(charts)); } catch {}
  }, [charts]);

  function update(id: string, c: ChartConfig) {
    setCharts((prev) => prev.map((x) => (x.id === id ? c : x)));
  }
  function remove(id: string) { setCharts((prev) => prev.filter((x) => x.id !== id)); }
  function add() {
    if (charts.length >= 3) return;
    setCharts((prev) => [...prev, { id: String(Date.now()), metric: "popular_job", type: "bar" }]);
  }

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Analytics</h2>
        <Button variant="outline" size="sm" onClick={add} disabled={charts.length >= 3}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
      {charts.map((c) => (
        <ChartCard key={c.id} config={c} jobs={jobs} onChange={(nc) => update(c.id, nc)} onRemove={() => remove(c.id)} />
      ))}
      {charts.length === 0 && (
        <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
          No charts. Click "Add" to create one (max 3).
        </div>
      )}
    </aside>
  );
}
