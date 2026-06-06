import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { loadUserPrefs, saveUserPrefs, getPref } from "@/lib/userPrefs";
import { TimeRangeBar, resolveRange, type RangeKey, type SavedRange } from "@/components/databoard/TimeRangeBar";
import { WidgetGrid, type WidgetConfig } from "@/components/databoard/WidgetGrid";
import { AddWidgetMenu } from "@/components/databoard/AddWidgetMenu";
import { FiltersBar, applyFilters } from "@/components/databoard/FiltersBar";
import { ViewTemplatesMenu } from "@/components/databoard/ViewTemplatesMenu";
import { ExportBoardDialog } from "@/components/databoard/ExportBoardDialog";
import { getDataBoardJobs } from "@/lib/databoard/queries.functions";
import { EMPTY_FILTERS, loadDataBoardPrefs, saveFilters, type DataBoardFilters } from "@/lib/databoard/templates";
import { JobDialog } from "@/components/AddJobDialog";
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
  { i: "w-completed", type: "kpi", title: "Completed jobs", settings: { metric: "completed_count", label: "Completed jobs" } },
  { i: "w-avg", type: "kpi", title: "Avg ticket", settings: { metric: "avg_ticket", label: "Avg ticket" } },
  { i: "w-rev-time", type: "insight", title: "Revenue over time", settings: { dimension: "day", metric: "revenue", viz: "area", limit: 0, sort: "desc" } },
  { i: "w-top-techs", type: "insight", title: "Best closing techs", settings: { dimension: "tech_name", metric: "count", viz: "bar", limit: 8, sort: "desc", completedOnly: true } },
  { i: "w-status", type: "insight", title: "Status breakdown", settings: { dimension: "status", metric: "count", viz: "pie", limit: 10, sort: "desc" } },
  { i: "w-activity", type: "activity", title: "Recent jobs", settings: { limit: 20 } },
];

/**
 * Strip the per-widget `completedOnly` flag from previously saved widgets so
 * generic KPIs and insights no longer silently restrict to Completed jobs.
 * Only the dedicated `completed_count` KPI and the "Best closing techs"
 * insight (which is conceptually about closing rate) keep that behavior.
 */
function normalizeSavedWidgets(widgets: WidgetConfig[]): WidgetConfig[] {
  return widgets.map((w) => {
    const s = w.settings || {};
    if (!s.completedOnly) return w;
    if (w.type === "kpi" && s.metric === "completed_count") return w;
    const isClosingTechs = w.type === "insight" && (w.title || "").toLowerCase().includes("best closing");
    if (isClosingTechs) return w;
    const { completedOnly: _drop, ...rest } = s;
    return { ...w, settings: rest };
  });
}

function greetingFor(name: string | null) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const first = (name || "there").trim().split(/\s+/)[0];
  return `${part}, ${first} 👋`;
}

function DataBoardPage() {
  const { session, displayName, can, loading: authLoading } = useAuth();
  const getDataBoardJobsFn = useServerFn(getDataBoardJobs);
  const canView = can("databoard.view");
  const canEditLayout = can("databoard.edit_layout");
  const canViewAll = can("databoard.view_all");
  const canSeeMarketerPay = can("marketer.view_percentage");

  const isMobile = useIsMobile();
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);
  // On touch/mobile devices, always keep the board locked so widgets never
  // move while the user scrolls — regardless of the toggle state.
  const dragEnabled = editing && !isMobile;
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [layouts, setLayouts] = useState<Record<string, any[]>>({});
  const [rangeKey, setRangeKey] = useState<RangeKey>("this_month");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [savedRanges, setSavedRanges] = useState<SavedRange[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [undatedCount, setUndatedCount] = useState(0);
  const [totalMatched, setTotalMatched] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [scopeTechName, setScopeTechName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFiltersState] = useState<DataBoardFilters>(EMPTY_FILTERS);
  const [activeViewId, setActiveViewId] = useState<string>("");
  const [openJob, setOpenJob] = useState<Job | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const range = useMemo(() => resolveRange(rangeKey, customRange), [rangeKey, customRange]);

  // Load prefs
  useEffect(() => {
    loadUserPrefs().then(() => {
      const db = getPref<any>("databoard") || {};
      if (Array.isArray(db.widgets) && db.widgets.length) setWidgets(normalizeSavedWidgets(db.widgets));
      if (db.layouts && typeof db.layouts === "object") setLayouts(db.layouts);
      if (Array.isArray(db.savedRanges)) setSavedRanges(db.savedRanges);
      if (typeof db.rangeKey === "string") setRangeKey(db.rangeKey);
      if (db.customRange) setCustomRange(db.customRange);
      const p = loadDataBoardPrefs();
      setFiltersState(p.filters);
      setActiveViewId(p.activeViewId);
      setHydrated(true);
    });
  }, []);

  async function refetch() {
    if (!range || !session?.access_token) return;
    setLoading(true);
    try {
      const res = await getDataBoardJobsFn({
        data: {
          accessToken: session.access_token,
          range,
        },
      });
      setJobs(res.jobs as Job[]);
      setUndatedCount(res.undatedCount || 0);
      setTotalMatched(res.totalMatched || 0);
      setLastSyncedAt(res.fetchedAt || null);
      setScopeTechName(res.scopeTechName || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrated || !session?.access_token) return;
    refetch();
    if (refetchTimer.current) clearInterval(refetchTimer.current);
    refetchTimer.current = setInterval(refetch, 60000);
    return () => { if (refetchTimer.current) clearInterval(refetchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, rangeKey, customRange, session?.access_token]);

  useEffect(() => {
    if (!hydrated || !session?.user?.id) return;
    const channel = supabase
      .channel(`databoard-jobs-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => { refetch(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.user?.id, session?.access_token, rangeKey, customRange]);

  useEffect(() => {
    if (!hydrated) return;
    saveUserPrefs({ databoard: { widgets, layouts, rangeKey, customRange, savedRanges } });
  }, [hydrated, widgets, layouts, rangeKey, customRange, savedRanges]);

  useEffect(() => {
    if (!hydrated) return;
    saveFilters(filters);
  }, [hydrated, filters]);

  const filteredJobs = useMemo(() => applyFilters(jobs, filters), [jobs, filters]);

  function handleOpenJob(job: Job) {
    setOpenJob(job);
    setJobDialogOpen(true);
  }

  if (authLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!canView) return <Navigate to="/" />;

  const greeting = greetingFor(displayName);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{greeting}</h1>
              <p className="text-xs text-muted-foreground">Let's see how everything looks today.</p>
            </div>
            {loading && <span className="text-xs text-muted-foreground">Refreshing…</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ViewTemplatesMenu
              current={{ widgets, layouts, filters, rangeKey, customRange }}
              onApply={(t) => {
                setWidgets(normalizeSavedWidgets(t.widgets));
                setLayouts(t.layouts);
                setFiltersState(t.filters);
                setRangeKey(t.rangeKey);
                setCustomRange(t.customRange);
              }}
              activeId={activeViewId}
              onActiveChange={setActiveViewId}
            />
            <ExportBoardDialog
              greeting={greeting}
              jobs={filteredJobs}
              filters={filters}
              range={range}
              boardElementId="databoard-grid"
            />
            {canEditLayout && !isMobile && (
              <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                <Switch id="edit-layout" checked={editing} onCheckedChange={setEditing} />
                <Label htmlFor="edit-layout" className="text-sm cursor-pointer select-none">
                  Edit & drag widgets
                </Label>
              </div>
            )}
            {canEditLayout && isMobile && (
              <span className="text-xs text-muted-foreground">View only on mobile</span>
            )}
            {dragEnabled && (
              <AddWidgetMenu canSeeMarketerPay={canSeeMarketerPay} onAdd={(w) => setWidgets((prev) => [...prev, w])} />
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

        <FiltersBar
          jobs={jobs}
          filters={filters}
          onChange={setFiltersState}
          canSeeMarketers={canViewAll || canSeeMarketerPay}
        />

        {undatedCount > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 -mt-2 px-1">
            {undatedCount} job{undatedCount === 1 ? "" : "s"} have no date set and aren't included in this range.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1 -mt-1">
          <span>
            {totalMatched.toLocaleString()} matched job{totalMatched === 1 ? "" : "s"} in this range
          </span>
          {lastSyncedAt && (
            <span>
              Synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        <div id="databoard-grid">
          <WidgetGrid
            widgets={widgets}
            layouts={layouts}
            jobs={filteredJobs}
            editing={dragEnabled}
            onLayoutChange={(l) => setLayouts(l)}
            onRemove={(id) => setWidgets((prev) => prev.filter((w) => w.i !== id))}
            onUpdate={(id, patch) => setWidgets((prev) => prev.map((w) => w.i === id ? { ...w, ...patch } : w))}
            onOpenJob={handleOpenJob}
          />
        </div>

        {scopeTechName ? (
          <div className="text-xs text-muted-foreground">
            Showing data for: <span className="font-medium">{scopeTechName}</span>
          </div>
        ) : null}
      </div>

      {openJob && (
        <JobDialog
          job={openJob}
          open={jobDialogOpen}
          onOpenChange={(v) => { setJobDialogOpen(v); if (!v) setOpenJob(null); }}
          onJobSaved={() => { refetch(); }}
        />
      )}
    </div>
  );
}
