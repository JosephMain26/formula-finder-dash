import { useMemo, useState, useEffect } from "react";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { loadUserPrefs, saveUserPrefs, getPref } from "@/lib/userPrefs";

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

function defaults(): ChartConfig[] {
  return [
    { id: "1", metric: "revenue_per_day", type: "line" },
    { id: "2", metric: "popular_job", type: "pie" },
    { id: "3", metric: "jobs_per_tech", type: "bar" },
  ];
}

function loadChartsLS(): ChartConfig[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

const profit = (j: Job) =>
  Number(j.price || 0) - Number(j.cost || 0) - Number(j.parts || 0) - Number(j.cc_fee || 0);

function keyForJob(j: Job, metric: MetricKey): string | null {
  switch (metric) {
    case "popular_job": return j.job_type || "Unknown";
    case "jobs_per_tech":
    case "profit_per_tech": return j.tech_name || "Unassigned";
    case "jobs_per_marketer": return j.company_1 || j.company || "Unknown";
    case "payment_method": return j.payment || "Unspecified";
    case "revenue_per_day":
    case "profit_per_day": return j.job_date || null;
  }
}

function aggregate(jobs: Job[], metric: MetricKey): { name: string; value: number }[] {
  const map = new Map<string, number>();
  const isDate = metric === "revenue_per_day" || metric === "profit_per_day";

  jobs.forEach((j) => {
    const k = keyForJob(j, metric);
    if (!k) return;
    let v = 1;
    if (metric === "revenue_per_day") v = Number(j.price || 0);
    else if (metric === "profit_per_day" || metric === "profit_per_tech") v = profit(j);
    map.set(k, (map.get(k) || 0) + v);
  });

  const arr = [...map.entries()].map(([name, value]) => ({ name, value }));
  return isDate ? arr.sort((a, b) => a.name.localeCompare(b.name)) : arr.sort((a, b) => b.value - a.value).slice(0, 8);
}

function ChartCard({
  config, jobs, onChange, onRemove, onDrill,
}: {
  config: ChartConfig; jobs: Job[];
  onChange: (c: ChartConfig) => void; onRemove: () => void;
  onDrill: (metric: MetricKey, key: string) => void;
}) {
  const data = useMemo(() => aggregate(jobs, config.metric), [jobs, config.metric]);
  const label = METRICS.find((m) => m.key === config.metric)?.label || "";
  const handleClick = (d: any) => { if (d?.name) onDrill(config.metric, d.name); };

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
      <div className="text-xs text-muted-foreground">{label} · click to drill down</div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          {config.type === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={60} label={(e) => e.name}
                onClick={handleClick} className="cursor-pointer">
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : config.type === "line" ? (
            <LineChart data={data} onClick={(e: any) => e?.activeLabel && onDrill(config.metric, e.activeLabel)}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} className="cursor-pointer" />
            </LineChart>
          ) : (
            <BarChart data={data} onClick={(e: any) => e?.activeLabel && onDrill(config.metric, e.activeLabel)}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS[0]} className="cursor-pointer" />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}

function fmt(n: number | null | undefined) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function DrillDialog({
  open, onOpenChange, metric, value, jobs,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  metric: MetricKey | null; value: string | null; jobs: Job[];
}) {
  const matched = useMemo(() => {
    if (!metric || !value) return [];
    return jobs.filter((j) => keyForJob(j, metric) === value);
  }, [metric, value, jobs]);

  const label = metric ? METRICS.find((m) => m.key === metric)?.label : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{label}: {value} ({matched.length} jobs)</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Tech</th>
                <th className="text-left p-2">Marketer</th>
                <th className="text-left p-2">Job Type</th>
                <th className="text-left p-2">Payment</th>
                <th className="text-right p-2">Price</th>
                <th className="text-right p-2">Profit</th>
              </tr>
            </thead>
            <tbody>
              {matched.map((j) => (
                <tr key={j.id} className="border-t">
                  <td className="p-2">{j.job_date || "-"}</td>
                  <td className="p-2">{j.tech_name || "-"}</td>
                  <td className="p-2">{j.company_1 || j.company || "-"}</td>
                  <td className="p-2">{j.job_type || "-"}</td>
                  <td className="p-2">{j.payment || "-"}</td>
                  <td className="p-2 text-right">{fmt(j.price)}</td>
                  <td className="p-2 text-right">{fmt(profit(j))}</td>
                </tr>
              ))}
              {matched.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No matching jobs</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AnalyticsPanel({ jobs }: { jobs: Job[] }) {
  const [charts, setCharts] = useState<ChartConfig[]>(loadCharts);
  const [drill, setDrill] = useState<{ metric: MetricKey; value: string } | null>(null);

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
    <aside className="w-full h-full space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Analytics</h2>
        <Button variant="outline" size="sm" onClick={add} disabled={charts.length >= 3}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
      {charts.map((c) => (
        <ChartCard key={c.id} config={c} jobs={jobs}
          onChange={(nc) => update(c.id, nc)} onRemove={() => remove(c.id)}
          onDrill={(metric, value) => setDrill({ metric, value })} />
      ))}
      {charts.length === 0 && (
        <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
          No charts. Click "Add" to create one (max 3).
        </div>
      )}
      <DrillDialog
        open={!!drill}
        onOpenChange={(o) => !o && setDrill(null)}
        metric={drill?.metric ?? null}
        value={drill?.value ?? null}
        jobs={jobs}
      />
    </aside>
  );
}
