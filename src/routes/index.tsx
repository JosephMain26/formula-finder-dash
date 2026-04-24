import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatsCards } from "@/components/StatsCards";
import { JobFilters } from "@/components/JobFilters";
import { JobsTable } from "@/components/JobsTable";
import { AddJobDialog } from "@/components/AddJobDialog";
import { ColumnToggle, useColumnVisibility } from "@/components/ColumnToggle";
import { ExportReportDialog } from "@/components/ExportReportDialog";
import { BulkEditBar } from "@/components/BulkEditBar";
import { ParseMessageDialog } from "@/components/ParseMessageDialog";

import { DateRangePresets, type DateRange } from "@/components/DateRangePresets";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { MobileNav } from "@/components/MobileNav";
import { loadUserPrefs, saveUserPrefs, getPref } from "@/lib/userPrefs";

type Job = Tables<"jobs">;

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Jobs Dashboard" },
      { name: "description", content: "Track and manage service jobs with real-time calculations" },
    ],
  }),
});

function getGreeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

type SortKey = "job_date_desc" | "job_date_asc" | "created_desc" | "created_asc" | "price_desc" | "price_asc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "job_date_desc", label: "Date (newest first)" },
  { key: "job_date_asc", label: "Date (oldest first)" },
  { key: "created_desc", label: "Created (newest first)" },
  { key: "created_asc", label: "Created (oldest first)" },
  { key: "price_desc", label: "Price (high to low)" },
  { key: "price_asc", label: "Price (low to high)" },
];

function Dashboard() {
  const { role, isAdmin, displayName, signOut } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const { visibleColumns, toggle: toggleColumn, showAll: showAllColumns, setVisible: setVisibleColumns } = useColumnVisibility();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [techFilter, setTechFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [paidFilter, setPaidFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [greeting, setGreeting] = useState<string>(() => getGreeting());
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("job_date_desc");
  const [analyticsHidden, setAnalyticsHidden] = useState(false);

  // Load saved per-user dashboard prefs on mount
  useEffect(() => {
    loadUserPrefs().then(() => {
      const d = getPref<any>("dashboard") || {};
      if (typeof d.search === "string") setSearch(d.search);
      if (typeof d.statusFilter === "string") setStatusFilter(d.statusFilter);
      if (typeof d.techFilter === "string") setTechFilter(d.techFilter);
      if (typeof d.companyFilter === "string") setCompanyFilter(d.companyFilter);
      if (typeof d.jobTypeFilter === "string") setJobTypeFilter(d.jobTypeFilter);
      if (typeof d.paidFilter === "string") setPaidFilter(d.paidFilter);
      if (d.dateRange && typeof d.dateRange.from === "string" && typeof d.dateRange.to === "string") {
        setDateRange({ from: d.dateRange.from, to: d.dateRange.to });
      }
      if (typeof d.sortBy === "string" && SORT_OPTIONS.some((o) => o.key === d.sortBy)) {
        setSortBy(d.sortBy as SortKey);
      }
      const a = getPref<any>("analytics") || {};
      if (typeof a.hidden === "boolean") setAnalyticsHidden(a.hidden);
      setPrefsHydrated(true);
    });
  }, []);

  // Persist filter/date-range changes after hydration
  useEffect(() => {
    if (!prefsHydrated) return;
    saveUserPrefs({
      dashboard: {
        search, statusFilter, techFilter, companyFilter, jobTypeFilter, paidFilter,
        dateRange: dateRange ?? null,
        sortBy,
      },
    });
  }, [prefsHydrated, search, statusFilter, techFilter, companyFilter, jobTypeFilter, paidFilter, dateRange, sortBy]);

  useEffect(() => {
    if (!prefsHydrated) return;
    saveUserPrefs({ analytics: { hidden: analyticsHidden } });
  }, [prefsHydrated, analyticsHidden]);

  // Re-evaluate greeting at the next top-of-hour so morning→afternoon→evening flips without reload.
  useEffect(() => {
    const now = new Date();
    const msToNextHour = (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds() + 50;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setGreeting(getGreeting());
      interval = setInterval(() => setGreeting(getGreeting()), 60 * 60 * 1000);
    }, msToNextHour);
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval); };
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll(ids: string[], select: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => { if (select) next.add(id); else next.delete(id); });
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  async function fetchJobs() {
    setLoading(true);
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .order("job_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setJobs(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchJobs(); }, []);

  const uniqueValues = useMemo(() => {
    const get = (key: keyof Job) => [...new Set(jobs.map(j => j[key]).filter(Boolean) as string[])].sort();
    return {
      techs: get("tech_name"),
      companies: [...new Set(jobs.flatMap(j => [j.company_1, j.company]).filter(Boolean) as string[])].sort(),
      jobTypes: get("job_type"),
      statuses: get("status"),
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (search) {
        const s = search.toLowerCase();
        const searchable = [job.company_1, job.company, job.tech_name, job.po_number, job.address, job.notes, job.phone_no].join(" ").toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      if (statusFilter && statusFilter !== "all" && job.status !== statusFilter) return false;
      if (techFilter && techFilter !== "all" && job.tech_name !== techFilter) return false;
      if (companyFilter && companyFilter !== "all" && job.company_1 !== companyFilter && job.company !== companyFilter) return false;
      if (jobTypeFilter && jobTypeFilter !== "all" && job.job_type !== jobTypeFilter) return false;
      if (paidFilter === "yes" && !job.paid) return false;
      if (paidFilter === "no" && job.paid) return false;
      if (dateRange && job.job_date) {
        if (job.job_date < dateRange.from || job.job_date > dateRange.to) return false;
      } else if (dateRange && !job.job_date) {
        return false;
      }
      return true;
    });
  }, [jobs, search, statusFilter, techFilter, companyFilter, jobTypeFilter, paidFilter, dateRange]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmpStr = (a: string | null, b: string | null) => (a || "").localeCompare(b || "");
    const cmpNum = (a: number | null, b: number | null) => (Number(a || 0)) - (Number(b || 0));
    switch (sortBy) {
      case "job_date_asc":
        return arr.sort((a, b) => cmpStr(a.job_date, b.job_date));
      case "job_date_desc":
        return arr.sort((a, b) => cmpStr(b.job_date, a.job_date));
      case "created_asc":
        return arr.sort((a, b) => cmpStr(a.created_at, b.created_at));
      case "created_desc":
        return arr.sort((a, b) => cmpStr(b.created_at, a.created_at));
      case "price_asc":
        return arr.sort((a, b) => cmpNum(a.price, b.price));
      case "price_desc":
        return arr.sort((a, b) => cmpNum(b.price, a.price));
      default:
        return arr;
    }
  }, [filtered, sortBy]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setTechFilter("");
    setCompanyFilter("");
    setJobTypeFilter("");
    setPaidFilter("");
    setDateRange(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MobileNav className="lg:hidden" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">
                {greeting}{displayName ? `, ${displayName}` : ""} <span aria-hidden>👋</span>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                {role && (
                  <Badge variant="secondary" className="uppercase tracking-wide text-[10px] sm:text-xs">
                    {role}
                  </Badge>
                )}
                <span>here is a quick overview</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
            {isAdmin && (
              <Link to="/settings" className="hidden lg:inline-flex">
                <Button variant="outline"><Settings className="h-4 w-4 mr-2" /> Settings</Button>
              </Link>
            )}
            <ParseMessageDialog onJobSaved={fetchJobs} />
            <AddJobDialog onJobAdded={fetchJobs} />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out" className="hidden lg:inline-flex"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <StatsCards jobs={filtered} />

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="flex-1 min-w-0 bg-card rounded-xl border p-3 sm:p-5 space-y-4 sm:space-y-5">
            <div className="flex flex-wrap gap-3 items-end">
              <DateRangePresets range={dateRange} onChange={setDateRange} />
            </div>
            <JobFilters
              search={search} onSearchChange={setSearch}
              statusFilter={statusFilter} onStatusChange={setStatusFilter}
              techFilter={techFilter} onTechChange={setTechFilter}
              companyFilter={companyFilter} onCompanyChange={setCompanyFilter}
              jobTypeFilter={jobTypeFilter} onJobTypeChange={setJobTypeFilter}
              paidFilter={paidFilter} onPaidChange={setPaidFilter}
              onClear={clearFilters}
              techs={uniqueValues.techs}
              companies={uniqueValues.companies}
              jobTypes={uniqueValues.jobTypes}
              statuses={uniqueValues.statuses}
            />

            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading jobs...</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Showing {filtered.length} of {jobs.length} jobs</span>
                  <div className="flex items-center gap-2">
                    <ExportReportDialog jobs={jobs} companies={uniqueValues.companies} />
                    <ColumnToggle visibleColumns={visibleColumns} onToggle={toggleColumn} onShowAll={showAllColumns} onSetVisible={setVisibleColumns} />
                  </div>
                </div>
                <BulkEditBar
                  selectedIds={[...selectedIds].filter((id) => filtered.some((j) => j.id === id))}
                  onClear={clearSelection}
                  onChanged={() => { clearSelection(); fetchJobs(); }}
                  statuses={uniqueValues.statuses}
                />
                <JobsTable
                  jobs={filtered}
                  onJobsChanged={fetchJobs}
                  visibleColumns={visibleColumns}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAll}
                />
              </>
            )}
          </div>
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0">
            <AnalyticsPanel jobs={filtered} />
          </div>
        </div>
      </main>
    </div>
  );
}
