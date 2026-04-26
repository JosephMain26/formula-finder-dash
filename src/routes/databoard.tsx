import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loadUserPrefs, saveUserPrefs, getPref } from "@/lib/userPrefs";
import { TimeRangeBar, resolveRange, type RangeKey, type SavedRange } from "@/components/databoard/TimeRangeBar";
import { WidgetGrid, type WidgetConfig } from "@/components/databoard/WidgetGrid";
import { AddWidgetMenu } from "@/components/databoard/AddWidgetMenu";
import { FiltersBar, applyFilters } from "@/components/databoard/FiltersBar";
import { ViewTemplatesMenu } from "@/components/databoard/ViewTemplatesMenu";
import { ExportBoardDialog } from "@/components/databoard/ExportBoardDialog";
import { fetchJobsForRange, resolveUserScope, type Scope } from "@/lib/databoard/queries";
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
  { i: "w-revenue", type: "kpi", title: "Revenue (completed)", settings: { metric: "revenue", label: "Revenue", completedOnly: true } },
  { i: "w-profit", type: "kpi", title: "Profit (completed)", settings: { metric: "profit", label: "Profit", completedOnly: true } },
  { i: "w-completed", type: "kpi", title: "Completed jobs", settings: { metric: "completed_count", label: "Completed jobs" } },
  { i: "w-avg", type: "kpi", title: "Avg ticket (completed)", settings: { metric: "avg_ticket", label: "Avg ticket", completedOnly: true } },
  { i: "w-rev-time", type: "insight", title: "Revenue over time", settings: { dimension: "day", metric: "revenue", viz: "area", limit: 0, sort: "desc", completedOnly: true } },
  { i: "w-top-techs", type: "insight", title: "Best closing techs", settings: { dimension: "tech_name", metric: "count", viz: "bar", limit: 8, sort: "desc", completedOnly: true } },
  { i: "w-status", type: "insight", title: "Status breakdown", settings: { dimension: "status", metric: "count", viz: "pie", limit: 10, sort: "desc" } },
  { i: "w-activity", type: "activity", title: "Recent jobs", settings: { limit: 20 } },
];

function greetingFor(name: string | null) {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const first = (name || "there").trim().split(/\s+/)[0];
  return `${part}, ${first} 👋`;
}

function DataBoardPage() {
  const { user, displayName, can, loading: authLoading } = useAuth();
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
  const [undatedCount, setUndatedCount] = useState(0);
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
      if (Array.isArray(db.widgets) && db.widgets.length) setWidgets(db.widgets);
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

  useEffect(() => {
    if (!user) return;
    resolveUserScope({ userId: user.id, canViewAll }).then(setScope);
  }, [user, canViewAll]);

  async function refetch() {
    if (!range) return;
    setLoading(true);
    try {
      const res = await fetchJobsForRange(range, scope);
      setJobs(res.jobs);
      setUndatedCount(res.undatedCount);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    refetch();
    if (refetchTimer.current) clearInterval(refetchTimer.current);
    if (rangeKey === "today") refetchTimer.current = setInterval(refetch, 30000);
    return () => { if (refetchTimer.current) clearInterval(refetchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, rangeKey, customRange, scope.techName, scope.marketerName]);

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
                setWidgets(t.widgets);
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
            {canEditLayout && (
              <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing((e) => !e)}>
                {editing ? <><Eye className="h-4 w-4 mr-1" /> View</> : <><Pencil className="h-4 w-4 mr-1" /> Edit layout</>}
              </Button>
            )}
            {editing && (
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

        <div id="databoard-grid">
          <WidgetGrid
            widgets={widgets}
            layouts={layouts}
            jobs={filteredJobs}
            editing={editing}
            onLayoutChange={(l) => setLayouts(l)}
            onRemove={(id) => setWidgets((prev) => prev.filter((w) => w.i !== id))}
            onUpdate={(id, patch) => setWidgets((prev) => prev.map((w) => w.i === id ? { ...w, ...patch } : w))}
            onOpenJob={handleOpenJob}
          />
        </div>

        {scope.techName ? (
          <div className="text-xs text-muted-foreground">
            Showing data for: <span className="font-medium">{scope.techName}</span>
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
