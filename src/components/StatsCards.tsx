import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Briefcase, Users, Wrench, Megaphone, CheckCircle, TrendingUp, Package, Trophy, Star, ListOrdered, Settings2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface StatsCardsProps {
  jobs: Job[];
}

type StatKey =
  | "total_revenue"
  | "total_jobs"
  | "marketer_total"
  | "office_total"
  | "tech_total"
  | "avg_job_revenue"
  | "marketer_parts"
  | "office_parts"
  | "tech_parts"
  | "best_tech"
  | "best_marketer"
  | "top_job_types";

const STORAGE_KEY = "dashboard_stat_cards_v1";
const MAX_VISIBLE = 6;

const DEFAULT_KEYS: StatKey[] = [
  "total_revenue",
  "total_jobs",
  "marketer_total",
  "office_total",
  "tech_total",
  "avg_job_revenue",
];

const ALL_STATS: { key: StatKey; label: string }[] = [
  { key: "total_revenue", label: "Total Revenue" },
  { key: "total_jobs", label: "Total Jobs" },
  { key: "marketer_total", label: "Marketer Total" },
  { key: "office_total", label: "Office Total" },
  { key: "tech_total", label: "Tech Total" },
  { key: "avg_job_revenue", label: "Average Job Revenue" },
  { key: "marketer_parts", label: "Marketer Parts" },
  { key: "office_parts", label: "Office Parts" },
  { key: "tech_parts", label: "Tech Parts" },
  { key: "best_tech", label: "Best Closing Tech" },
  { key: "best_marketer", label: "Best Marketer" },
  { key: "top_job_types", label: "Top 3 Job Types" },
];

const fmt = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function topCount<T extends string | null | undefined>(items: T[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const it of items) {
    if (!it) continue;
    map.set(it, (map.get(it) || 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function computeStat(key: StatKey, jobs: Job[]): { label: string; value: string; sub?: string; icon: any; color: string } {
  switch (key) {
    case "total_revenue":
      return { label: "Total Revenue", value: fmt(jobs.reduce((s, j) => s + (j.price || 0), 0)), icon: DollarSign, color: "text-primary" };
    case "total_jobs":
      return { label: "Total Jobs", value: jobs.length.toString(), icon: Briefcase, color: "text-chart-2" };
    case "marketer_total":
      return { label: "Marketer Total", value: fmt(jobs.reduce((s, j) => s + ((j as any).total_marketer || 0), 0)), icon: Megaphone, color: "text-chart-4" };
    case "office_total":
      return { label: "Office Total", value: fmt(jobs.reduce((s, j) => s + (j.total_office || 0), 0)), icon: Users, color: "text-chart-3" };
    case "tech_total":
      return { label: "Tech Total", value: fmt(jobs.reduce((s, j) => s + (j.total_tech || 0), 0)), icon: Wrench, color: "text-chart-5" };
    case "avg_job_revenue": {
      const total = jobs.reduce((s, j) => s + (j.price || 0), 0);
      return { label: "Average Job Revenue", value: jobs.length ? fmt(total / jobs.length) : fmt(0), icon: TrendingUp, color: "text-primary" };
    }
    case "marketer_parts":
      return { label: "Marketer Parts", value: fmt(jobs.reduce((s, j) => s + ((j as any).co_parts || 0), 0)), icon: Package, color: "text-chart-4" };
    case "office_parts":
      return { label: "Office Parts", value: fmt(jobs.reduce((s, j) => s + ((j as any).office_parts || 0), 0)), icon: Package, color: "text-chart-3" };
    case "tech_parts":
      return { label: "Tech Parts", value: fmt(jobs.reduce((s, j) => s + ((j as any).parts || 0), 0)), icon: Package, color: "text-chart-5" };
    case "best_tech": {
      const top = topCount(jobs.map((j) => j.tech_name))[0];
      return { label: "Best Closing Tech", value: top?.name || "—", sub: top ? `${top.count} jobs` : undefined, icon: Trophy, color: "text-chart-5" };
    }
    case "best_marketer": {
      const top = topCount(jobs.map((j) => j.company_1 || j.company)) [0];
      return { label: "Best Marketer", value: top?.name || "—", sub: top ? `${top.count} jobs` : undefined, icon: Star, color: "text-chart-4" };
    }
    case "top_job_types": {
      const top = topCount(jobs.map((j) => j.job_type)).slice(0, 3);
      return {
        label: "Top 3 Job Types",
        value: top[0]?.name || "—",
        sub: top.length ? top.map((t) => `${t.name} (${t.count})`).join(", ") : undefined,
        icon: ListOrdered,
        color: "text-chart-2",
      };
    }
  }
}

export function StatsCards({ jobs }: StatsCardsProps) {
  const [selected, setSelected] = useState<StatKey[]>(DEFAULT_KEYS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StatKey[];
        if (Array.isArray(parsed) && parsed.length) {
          const valid = parsed.filter((k) => ALL_STATS.some((s) => s.key === k)).slice(0, MAX_VISIBLE);
          if (valid.length) setSelected(valid);
        }
      }
    } catch {}
  }, []);

  function toggle(key: StatKey) {
    setSelected((prev) => {
      let next: StatKey[];
      if (prev.includes(key)) {
        next = prev.filter((k) => k !== key);
      } else {
        if (prev.length >= MAX_VISIBLE) return prev;
        next = [...prev, key];
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const stats = selected.map((k) => computeStat(k, jobs));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{selected.length} of {MAX_VISIBLE} cards selected</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm"><Settings2 className="h-4 w-4 mr-2" /> Customize</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="text-xs text-muted-foreground mb-2">Pick up to {MAX_VISIBLE} cards</p>
            <div className="space-y-2 max-h-72 overflow-auto">
              {ALL_STATS.map((s) => {
                const checked = selected.includes(s.key);
                const disabled = !checked && selected.length >= MAX_VISIBLE;
                return (
                  <label key={s.key} className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}>
                    <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(s.key)} />
                    <span>{s.label}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, i) => (
          <Card key={`${stat.label}-${i}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{stat.label}</p>
                  <p className="text-xl font-bold mt-1 truncate" title={stat.value}>{stat.value}</p>
                  {stat.sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate" title={stat.sub}>{stat.sub}</p>}
                </div>
                <stat.icon className={`h-7 w-7 ${stat.color} opacity-80 shrink-0`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
