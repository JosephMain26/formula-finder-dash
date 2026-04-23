import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Briefcase, Users, Wrench, Megaphone, TrendingUp, Package, Trophy, Star, ListOrdered, Settings2, GripVertical } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { AutoFitText } from "@/components/AutoFitText";

type Job = Tables<"jobs">;

interface StatsCardsProps {
  jobs: Job[];
}

type StatKey =
  | "total_revenue" | "total_jobs" | "marketer_total" | "office_total" | "tech_total"
  | "avg_job_revenue" | "marketer_parts" | "office_parts" | "tech_parts"
  | "best_tech" | "best_marketer" | "top_job_types";

type CardConfig = { key: StatKey; w: number; h: number }; // w = column span 1..6, h = px

const STORAGE_KEY = "dashboard_stat_cards_v3";
const LEGACY_V2 = "dashboard_stat_cards_v2";
const LEGACY_V1 = "dashboard_stat_cards_v1";
const COLS = 6;
const MIN_W = 1;
const MAX_W = 6;
const MIN_H = 80;
const MAX_H = 600;
const DEFAULT_H = 96;
const ROW_PX = 8; // grid auto-row size; each card spans ceil(h / ROW_PX) rows

const DEFAULT_CONFIG: CardConfig[] = [
  { key: "total_revenue", w: 1, h: DEFAULT_H },
  { key: "total_jobs", w: 1, h: DEFAULT_H },
  { key: "marketer_total", w: 1, h: DEFAULT_H },
  { key: "office_total", w: 1, h: DEFAULT_H },
  { key: "tech_total", w: 1, h: DEFAULT_H },
  { key: "avg_job_revenue", w: 1, h: DEFAULT_H },
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
      const top = topCount(jobs.map((j) => j.company_1 || j.company))[0];
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

const colSpanClass = (w: number) => {
  switch (Math.max(MIN_W, Math.min(MAX_W, w))) {
    case 1: return "col-span-1";
    case 2: return "col-span-2";
    case 3: return "col-span-3";
    case 4: return "col-span-4";
    case 5: return "col-span-5";
    case 6: return "col-span-6";
    default: return "col-span-1";
  }
};

export function StatsCards({ jobs }: StatsCardsProps) {
  const [config, setConfig] = useState<CardConfig[]>(DEFAULT_CONFIG);
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [resizing, setResizing] = useState<{ index: number; startX: number; startY: number; startW: number; startH: number; colPx: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CardConfig[];
        if (Array.isArray(parsed) && parsed.length) {
          const valid = parsed
            .filter((c) => c && ALL_STATS.some((s) => s.key === c.key))
            .map((c) => ({
              key: c.key,
              w: Math.max(MIN_W, Math.min(MAX_W, Math.round(c.w || 1))),
              h: Math.max(MIN_H, Math.min(MAX_H, Math.round(c.h || DEFAULT_H))),
            }));
          if (valid.length) { setConfig(valid); return; }
        }
      }
      const v2 = localStorage.getItem(LEGACY_V2);
      if (v2) {
        const parsed = JSON.parse(v2) as { key: StatKey; size: 1 | 2 }[];
        if (Array.isArray(parsed) && parsed.length) {
          const valid = parsed
            .filter((c) => c && ALL_STATS.some((s) => s.key === c.key))
            .map<CardConfig>((c) => ({ key: c.key, w: c.size === 2 ? 2 : 1, h: DEFAULT_H }));
          if (valid.length) { setConfig(valid); return; }
        }
      }
      const v1 = localStorage.getItem(LEGACY_V1);
      if (v1) {
        const parsed = JSON.parse(v1) as StatKey[];
        if (Array.isArray(parsed) && parsed.length) {
          const valid = parsed
            .filter((k) => ALL_STATS.some((s) => s.key === k))
            .map<CardConfig>((k) => ({ key: k, w: 1, h: DEFAULT_H }));
          if (valid.length) setConfig(valid);
        }
      }
    } catch {}
  }, []);

  function persist(next: CardConfig[]) {
    setConfig(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function toggle(key: StatKey) {
    const exists = config.find((c) => c.key === key);
    if (exists) persist(config.filter((c) => c.key !== key));
    else persist([...config, { key, w: 1, h: DEFAULT_H }]);
  }

  function onDragStart(i: number) { dragIndex.current = i; }
  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (overIndex !== i) setOverIndex(i);
  }
  function onDrop(i: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from === null || from === i) return;
    const next = [...config];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    persist(next);
  }

  function startResize(e: React.PointerEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;
    const styles = getComputedStyle(grid);
    const gap = parseFloat(styles.columnGap || styles.gap || "16") || 16;
    const totalW = grid.clientWidth;
    const colPx = (totalW - gap * (COLS - 1)) / COLS;
    const c = config[index];
    setResizing({ index, startX: e.clientX, startY: e.clientY, startW: c.w, startH: c.h, colPx });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  useEffect(() => {
    if (!resizing) return;
    function onMove(e: PointerEvent) {
      const r = resizing!;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      const stepW = r.colPx + 16;
      // Use floor with a small bias so width changes feel responsive in both directions
      const deltaCols = Math.round(dx / stepW);
      const newW = Math.max(MIN_W, Math.min(MAX_W, r.startW + deltaCols));
      const newH = Math.max(MIN_H, Math.min(MAX_H, r.startH + dy));
      setConfig((prev) => {
        const next = [...prev];
        if (!next[r.index]) return prev;
        if (next[r.index].w === newW && next[r.index].h === newH) return prev;
        next[r.index] = { ...next[r.index], w: newW, h: newH };
        return next;
      });
    }
    function onUp() {
      setResizing(null);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizing, config]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Drag to reorder · drag bottom-right corner to resize width &amp; height</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm"><Settings2 className="h-4 w-4 mr-2" /> Customize</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <p className="text-xs text-muted-foreground mb-2">Pick which cards to show</p>
            <div className="space-y-2 max-h-72 overflow-auto">
              {ALL_STATS.map((s) => {
                const checked = config.some((c) => c.key === s.key);
                return (
                  <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(s.key)} />
                    <span>{s.label}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div
        ref={gridRef}
        className="grid grid-cols-6 gap-4"
        style={{ gridAutoRows: `${ROW_PX}px`, gridAutoFlow: "row dense" }}
      >
        {config.map((c, i) => {
          const stat = computeStat(c.key, jobs);
          const rowSpan = Math.max(1, Math.ceil((c.h + 16) / (ROW_PX + 16))); // include gap
          return (
            <Card
              key={c.key}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDrop={() => onDrop(i)}
              onDragEnd={() => { dragIndex.current = null; setOverIndex(null); }}
              style={{ gridRow: `span ${rowSpan}` }}
              className={`${colSpanClass(c.w)} ${overIndex === i ? "ring-2 ring-primary" : ""} relative cursor-move transition-shadow`}
            >
              <CardContent className="p-3 h-full">
                <div className="flex items-stretch gap-2 h-full">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                  <div className="min-w-0 flex-1 flex flex-col" style={{ minWidth: 0 }}>
                    <div style={{ height: "22%", minHeight: 12 }}>
                      <AutoFitText text={stat.label} max={13} min={9} className="font-medium text-muted-foreground" />
                    </div>
                    <div style={{ height: stat.sub ? "48%" : "78%" }}>
                      <AutoFitText text={stat.value} max={36} min={11} className="font-bold" />
                    </div>
                    {stat.sub && (
                      <div style={{ height: "30%", minHeight: 12 }}>
                        <AutoFitText text={stat.sub} max={12} min={8} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <stat.icon className={`h-6 w-6 ${stat.color} opacity-80 shrink-0 mt-1`} />
                </div>
              </CardContent>
              <div
                onPointerDown={(e) => startResize(e, i)}
                title="Drag to resize"
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-60 hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(135deg, transparent 0 50%, hsl(var(--muted-foreground) / 0.6) 50% 60%, transparent 60% 70%, hsl(var(--muted-foreground) / 0.6) 70% 80%, transparent 80%)",
                }}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
