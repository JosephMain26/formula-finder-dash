import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loadUserPrefs, saveUserPrefs, getPref } from "@/lib/userPrefs";
import { TimeRangeBar, resolveRange, type RangeKey, type SavedRange } from "@/components/databoard/TimeRangeBar";
import { WidgetGrid, type WidgetConfig } from "@/components/databoard/WidgetGrid";
import { AddWidgetMenu } from "@/components/databoard/AddWidgetMenu";
import { fetchJobsForRange, resolveUserScope, type Scope } from "@/lib/databoard/queries";
import type { Tables } from "@/integrations/supabase/types";
import type { DateRange } from "@/components/DateRangePresets";

type Job = Tables<"jobs">;

export const Route = createFileRoute("/databoard")({
  component: DataBoardPage,
  head: () => ({
    meta: [
      { title: "DataBoard — Live performance" },
      { name: "description", content: "Customizable live performance dashboard with draggable widgets" },
    ],
  }),
});

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { i: "w-revenue", type: "kpi", title: "Revenue", settings: { metric: "revenue", label: "Revenue" } },
  { i: "w-profit", type: "kpi", title: "Profit", settings: { metric: "profit", label: "Profit" } },
  { i: "w-count", type: "kpi", title: "Job count", settings: { metric: "count", label: "Job count" } },
  { i: "w-avg", type: "kpi", title: "Avg ticket", settings: { metric: "avg_ticket", label: "Avg ticket" } },
  { i: "w-rev-time", type: "chart", title: "Revenue over time", settings: { variant: "revenue_over_time" } },
  { i: "w-top-techs", type: "chart", title: "Top techs", settings: { variant: "top_techs" } },
  { i: "w-status", type: "chart", title: "Status breakdown", settings: { variant: "status_breakdown" } },
  { i: "w-activity", type: "activity", title: "Recent jobs", settings: { limit: 20 } },
];

function DataBoardPage() {
  const { user, can, loading: authLoading } = useAuth();
  const canView = can("databoard.view");
  const canEditLayout = can("databoard.edit_layout");
  const canViewAll = can("databoard.view_all");
  const canSeeMarketerPay = can("marketer.view_percentage");

  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [layouts, setLayouts] = useState<Record<string, any[]>>({});
  const [rangeKey, setRangeKey] = useState<RangeKey>("today");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [savedRanges, setSavedRanges] = useState<SavedRange[]>([]);
  const [scope, setScope] = useState<Scope>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const range = useMemo(() => resolveRange(rangeKey, customRange), [rangeKey, customRange]);

  // Load prefs
  useEffect(() => {
    loadUserPrefs().then(() => {
      const db = getPref<any>("databoard") || {};
      if (Array.isArray(db.widgets) && db.widgets.length) setWidgets(db.widgets);
      if (db.layouts && typeof db.layouts === "object") setLayouts(db.layouts);
      if (Array.isArray(db.savedRanges)) setSavedRanges(db.savedRanges);
      if (typeof db.rangeKey === "string") setRangeKey(db.rangeKey);
      if (db.customRange) setCustomRange(db.customRange);
      setHydrated(true);
    });
  }, []);

  // Resolve scope
  useEffect(() => {
    if (!user) return;
    resolveUserScope({ userId: user.id, canViewAll }).then(setScope);
  }, [user, canViewAll]);

  // Fetch jobs
  async function refetch() {
    if (!range) return;
    setLoading(true);
    try {
      const data = await fetchJobsForRange(range, scope);
      setJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    refetch();
    // Live mode: refresh every 30s
    if (refetchTimer.current) clearInterval(refetchTimer.current);
    if (rangeKey === "today") {
      refetchTimer.current = setInterval(refetch, 30000);
    }
    return () => {
      if (refetchTimer.current) clearInterval(refetchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, rangeKey, customRange, scope.techName, scope.marketerName]);

  // Persist layout/widgets
  useEffect(() => {
    if (!hydrated) return;
    saveUserPrefs({ databoard: { widgets, layouts, rangeKey, customRange, savedRanges } });
  }, [hydrated, widgets, layouts, rangeKey, customRange, savedRanges]);

  if (authLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!canView) return <Navigate to="/" />;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <h1 className="text-lg font-semibold">DataBoard</h1>
            {loading && <span className="text-xs text-muted-foreground">Refreshing…</span>}
          </div>
          <div className="flex items-center gap-2">
            {canEditLayout && (
              <Button
                size="sm"
                variant={editing ? "default" : "outline"}
                onClick={() => setEditing((e) => !e)}
              >
                {editing ? <><Eye className="h-4 w-4 mr-1" /> View</> : <><Pencil className="h-4 w-4 mr-1" /> Edit layout</>}
              </Button>
            )}
            {editing && (
              <AddWidgetMenu
                canSeeMarketerPay={canSeeMarketerPay}
                onAdd={(w) => setWidgets((prev) => [...prev, w])}
              />
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 space-y-4">
        <TimeRangeBar
          rangeKey={rangeKey}
          customRange={customRange}
          savedRanges={savedRanges}
          onChange={(k, c) => { setRangeKey(k); setCustomRange(c); }}
          onSaveRange={(r) => setSavedRanges((p) => [...p, r])}
          onDeleteSaved={(id) => setSavedRanges((p) => p.filter((x) => x.id !== id))}
        />

        <WidgetGrid
          widgets={widgets}
          layouts={layouts}
          jobs={jobs}
          editing={editing}
          onLayoutChange={(l) => setLayouts(l)}
          onRemove={(id) => setWidgets((prev) => prev.filter((w) => w.i !== id))}
        />

        {!scope.techName && canViewAll ? null : scope.techName ? (
          <div className="text-xs text-muted-foreground">
            Showing data for: <span className="font-medium">{scope.techName}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
