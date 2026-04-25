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

export type WidgetType = "kpi" | "chart" | "table" | "goal" | "activity" | "calendar" | "map";

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
  onOpenJob?: (job: Job) => void;
}

const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };

function defaultSize(type: WidgetType): { w: number; h: number; minW: number; minH: number } {
  switch (type) {
    case "kpi": return { w: 3, h: 3, minW: 2, minH: 2 };
    case "chart": return { w: 6, h: 5, minW: 3, minH: 3 };
    case "table": return { w: 4, h: 5, minW: 3, minH: 3 };
    case "goal": return { w: 4, h: 3, minW: 2, minH: 2 };
    case "activity": return { w: 4, h: 6, minW: 3, minH: 3 };
    case "calendar": return { w: 6, h: 7, minW: 4, minH: 5 };
    case "map": return { w: 6, h: 7, minW: 4, minH: 5 };
  }
}

export function WidgetGrid({ widgets, layouts, jobs, editing, onLayoutChange, onRemove, onOpenJob }: Props) {
  const computedLayouts = useMemo<Layouts>(() => {
    const out: Layouts = {};
    const keys: (keyof typeof COLS)[] = ["lg", "md", "sm", "xs", "xxs"];
    for (const bp of keys) {
      const existing = layouts?.[bp] || [];
      const map = new Map<string, Layout>(existing.map((l: Layout) => [l.i, l]));
      let y = 0;
      const merged: Layout[] = widgets.map((w, idx) => {
        const found = map.get(w.i);
        if (found) return found;
        const sz = defaultSize(w.type);
        const item: Layout = { i: w.i, x: (idx * sz.w) % COLS[bp], y, w: sz.w, h: sz.h, minW: sz.minW, minH: sz.minH };
        y += sz.h;
        return item;
      });
      out[bp] = merged;
    }
    return out;
  }, [widgets, layouts]);

  const handleChange = useCallback(
    (_curr: Layout[], all: Layouts) => {
      onLayoutChange(all);
    },
    [onLayoutChange]
  );

  function renderWidget(w: WidgetConfig) {
    switch (w.type) {
      case "kpi": return <KpiWidget jobs={jobs} metric={w.settings.metric} label={w.settings.label} />;
      case "chart": return <ChartWidget jobs={jobs} variant={w.settings.variant} />;
      case "table": return <TableWidget jobs={jobs} groupBy={w.settings.groupBy} metric={w.settings.metric} />;
      case "goal": return <GoalWidget jobs={jobs} target={Number(w.settings.target) || 0} metric={w.settings.metric} />;
      case "activity": return <ActivityWidget jobs={jobs} limit={w.settings.limit} />;
      case "calendar": return <CalendarWidget jobs={jobs} onOpenJob={onOpenJob} />;
      case "map": return <MapWidget jobs={jobs} onOpenJob={onOpenJob} />;
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
    <ResponsiveGridLayout
      key={editing ? "edit" : "view"}
      className="layout"
      layouts={computedLayouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={50}
      margin={[8, 8]}
      isDraggable={editing}
      isResizable={editing}
      draggableHandle={editing ? ".drag-handle" : undefined}
      resizeHandles={editing ? ["se", "e", "s"] : []}
      onLayoutChange={handleChange}
    >
      {widgets.map((w) => (
        <div key={w.i}>
          <WidgetCard title={w.title} editing={editing} onRemove={() => onRemove(w.i)}>
            {renderWidget(w)}
          </WidgetCard>
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
