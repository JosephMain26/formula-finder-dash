import { useMemo, useCallback, useEffect, useRef, useState, forwardRef } from "react";
import { Responsive as ResponsiveBase } from "react-grid-layout";

type Layout = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };
type Layouts = Record<string, Layout[]>;
import type { Tables } from "@/integrations/supabase/types";
import { WidgetCard } from "./WidgetCard";
import { KpiWidget } from "./widgets/KpiWidget";
import { ChartWidget } from "./widgets/ChartWidget";
import { TableWidget } from "./widgets/TableWidget";
import { GoalWidget } from "./widgets/GoalWidget";
import { ActivityWidget } from "./widgets/ActivityWidget";
import { CalendarWidget } from "./widgets/CalendarWidget";
import { MapWidget } from "./widgets/MapWidget";
import { InsightWidget } from "./widgets/InsightWidget";
import { InsightSettingsDialog } from "./InsightSettingsDialog";

// Lightweight WidthProvider replacement (the installed react-grid-layout no longer exports WidthProvider)
const ResponsiveGridLayout = forwardRef<any, any>(function ResponsiveGridLayout(props, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(1200);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setWidth(el.offsetWidth || 1200);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const Comp: any = ResponsiveBase;
  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <Comp {...props} ref={ref} width={width} />
    </div>
  );
});

type Job = Tables<"jobs">;

export type WidgetType = "kpi" | "chart" | "table" | "goal" | "activity" | "calendar" | "map" | "insight";

export interface WidgetConfig {
  i: string;
  type: WidgetType;
  title: string;
  settings: Record<string, any>;
}

interface Props {
  widgets: WidgetConfig[];
  layouts: Layouts;
  jobs: Job[];
  editing: boolean;
  onLayoutChange: (layouts: Layouts) => void;
  onRemove: (id: string) => void;
  onUpdate?: (id: string, patch: Partial<WidgetConfig>) => void;
  onOpenJob?: (job: Job) => void;
}

const COLS = { lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 };
const BREAKPOINTS = { lg: 1400, md: 1100, sm: 800, xs: 520, xxs: 0 };

function defaultSize(type: WidgetType): { w: number; h: number; minW: number; minH: number } {
  switch (type) {
    case "kpi": return { w: 6, h: 4, minW: 3, minH: 3 };
    case "chart": return { w: 12, h: 8, minW: 5, minH: 5 };
    case "table": return { w: 8, h: 8, minW: 4, minH: 4 };
    case "goal": return { w: 8, h: 5, minW: 4, minH: 3 };
    case "activity": return { w: 8, h: 10, minW: 4, minH: 5 };
    case "calendar": return { w: 12, h: 12, minW: 6, minH: 8 };
    case "map": return { w: 12, h: 12, minW: 6, minH: 8 };
    case "insight": return { w: 12, h: 8, minW: 4, minH: 4 };
  }
}

export function WidgetGrid({ widgets, layouts, jobs, editing, onLayoutChange, onRemove, onUpdate, onOpenJob }: Props) {
  const [configuring, setConfiguring] = useState<string | null>(null);
  const configWidget = widgets.find((w) => w.i === configuring);
  const computedLayouts = useMemo<Layouts>(() => {
    const out: Layouts = {};
    const keys: (keyof typeof COLS)[] = ["lg", "md", "sm", "xs", "xxs"];
    for (const bp of keys) {
      const existing = layouts?.[bp] || [];
      const map = new Map<string, Layout>(existing.map((l: Layout) => [l.i, l]));
      let y = 0;
      const merged: Layout[] = widgets.map((w, idx) => {
        const found = map.get(w.i);
        const sz = defaultSize(w.type);
        if (found) {
          // Clamp legacy layouts (saved against old smaller grid) up to new minimums
          return {
            ...found,
            w: Math.max(found.w, sz.minW),
            h: Math.max(found.h, sz.minH),
            minW: sz.minW,
            minH: sz.minH,
          };
        }
        const item: Layout = { i: w.i, x: (idx * sz.w) % COLS[bp], y, w: sz.w, h: sz.h, minW: sz.minW, minH: sz.minH };
        y += sz.h;
        return item;
      });
      out[bp] = merged.map((item) => ({ ...item, static: !editing }));
    }
    return out;
  }, [widgets, layouts]);

  const handleChange = useCallback(
    (_curr: Layout[], all: Layouts) => {
      onLayoutChange(all);
    },
    [onLayoutChange]
  );

  function legacyChartToInsight(variant: string): import("./widgets/InsightWidget").InsightSettings {
    switch (variant) {
      case "revenue_over_time": return { dimension: "day", metric: "revenue", viz: "area", limit: 0, sort: "desc" };
      case "top_techs": return { dimension: "tech_name", metric: "revenue", viz: "bar", limit: 8, sort: "desc" };
      case "top_companies": return { dimension: "company", metric: "revenue", viz: "bar", limit: 8, sort: "desc" };
      case "status_breakdown": return { dimension: "status", metric: "count", viz: "pie", limit: 10, sort: "desc" };
      case "payment_split": return { dimension: "payment", metric: "revenue", viz: "donut", limit: 10, sort: "desc" };
      default: return { dimension: "tech_name", metric: "count", viz: "bar", limit: 10, sort: "desc" };
    }
  }
  function legacyTableToInsight(s: any): import("./widgets/InsightWidget").InsightSettings {
    return { dimension: (s?.groupBy || "tech_name"), metric: (s?.metric || "count"), viz: "table", limit: 15, sort: "desc" };
  }

  function renderWidget(w: WidgetConfig) {
    switch (w.type) {
      case "kpi": return <KpiWidget jobs={jobs} metric={w.settings.metric} label={w.settings.label} completedOnly={w.settings.completedOnly} />;
      // Legacy chart/table widgets are transparently rendered through InsightWidget,
      // so the user can switch viz types via the gear icon — same as native insights.
      case "chart": return <InsightWidget jobs={jobs} settings={legacyChartToInsight(w.settings.variant)} />;
      case "table": return <InsightWidget jobs={jobs} settings={legacyTableToInsight(w.settings)} />;
      case "goal": return <GoalWidget jobs={jobs} target={Number(w.settings.target) || 0} metric={w.settings.metric} />;
      case "activity": return <ActivityWidget jobs={jobs} limit={w.settings.limit} />;
      case "calendar": return <CalendarWidget jobs={jobs} onOpenJob={onOpenJob} />;
      case "map": return <MapWidget jobs={jobs} onOpenJob={onOpenJob} />;
      case "insight": return <InsightWidget jobs={jobs} settings={w.settings as any} />;
    }
  }

  if (!widgets.length) {
    return (
      <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
        No widgets yet. Click "Edit layout" then "Add widget" to start.
      </div>
    );
  }

  return (
    <>
      <ResponsiveGridLayout
        key={editing ? "edit" : "view"}
        className="layout"
        layouts={computedLayouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={30}
        margin={[8, 8]}
        isDraggable={editing}
        isResizable={editing}
        allowMobileScroll
        draggableHandle=".drag-handle"
        resizeHandles={editing ? ["s", "w", "e", "n", "sw", "nw", "se", "ne"] : []}
        onLayoutChange={handleChange}
      >
        {widgets.map((w) => {
          const isConfigurable = w.type === "insight" || w.type === "chart" || w.type === "table";
          return (
            <div key={w.i} data-pdf-section data-widget-type={w.type}>
              <WidgetCard
                title={w.title}
                editing={editing}
                onRemove={() => onRemove(w.i)}
                onConfigure={editing && isConfigurable && onUpdate ? () => setConfiguring(w.i) : undefined}
              >
                {renderWidget(w)}
              </WidgetCard>
            </div>
          );
        })}
      </ResponsiveGridLayout>

      {configWidget && (configWidget.type === "insight" || configWidget.type === "chart" || configWidget.type === "table") && onUpdate && (
        <InsightSettingsDialog
          open={!!configuring}
          onOpenChange={(v) => { if (!v) setConfiguring(null); }}
          title={configWidget.title}
          settings={
            configWidget.type === "insight"
              ? (configWidget.settings as any)
              : configWidget.type === "chart"
                ? legacyChartToInsight(configWidget.settings.variant)
                : legacyTableToInsight(configWidget.settings)
          }
          onSave={(title, settings) => {
            // Always persist as a native insight widget so the user gets full control on next reload.
            onUpdate(configWidget.i, { title, type: "insight", settings } as any);
          }}
        />
      )}
    </>
  );
}
