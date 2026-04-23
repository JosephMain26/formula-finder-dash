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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Settings, LogOut } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";

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

function Dashboard() {
  const { user, role, isAdmin, signOut } = useAuth();
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
    const { data } = await supabase.from("jobs").select("*").order("job_date", { ascending: false });
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
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Jobs Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track and manage all service jobs</p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-xs font-medium">{user.email}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{role || "—"}</span>
              </div>
            )}
            {isAdmin && (
              <Link to="/settings">
                <Button variant="outline"><Settings className="h-4 w-4 mr-2" /> Settings</Button>
              </Link>
            )}
            <ParseMessageDialog onJobSaved={fetchJobs} />
            <AddJobDialog onJobAdded={fetchJobs} />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        <StatsCards jobs={filtered} />

        <ResizablePanelGroup orientation="horizontal" className="min-h-[600px] gap-0">
          <ResizablePanel defaultSize={75} minSize={40}>
            <div className="bg-card rounded-xl border p-5 space-y-5 h-full overflow-auto">
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
                  <div className="flex items-center justify-between">
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
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-3" />
          <ResizablePanel defaultSize={25} minSize={15}>
            <div className="h-full overflow-auto pr-1">
              <AnalyticsPanel jobs={filtered} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
