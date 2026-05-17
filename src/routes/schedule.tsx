import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, BellOff, ArrowLeft, Clock } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { RescheduleDialog } from "@/components/schedule/RescheduleDialog";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { Job } from "@/lib/notifications";

export const Route = createFileRoute("/schedule")({
  component: SchedulePage,
  head: () => ({
    meta: [
      { title: "Schedule — Jobs" },
      { name: "description", content: "Schedule, reschedule, and control reminders for upcoming jobs." },
    ],
  }),
});

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SchedulePage() {
  const { canViewAll } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [techFilter, setTechFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [editing, setEditing] = useState<Job | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragJobId, setDragJobId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("jobs")
      .select("*")
      .order("job_date", { ascending: true })
      .order("job_time", { ascending: true });
    setJobs((data as Job[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => jobs.filter((j) => {
    if (techFilter !== "all" && j.tech_name !== techFilter) return false;
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (companyFilter !== "all" && j.company_1 !== companyFilter && j.company !== companyFilter) return false;
    return true;
  }), [jobs, techFilter, statusFilter, companyFilter]);

  const byDay = useMemo(() => {
    const m = new Map<string, Job[]>();
    for (const j of filtered) {
      if (!j.job_date) continue;
      const arr = m.get(j.job_date) || [];
      arr.push(j);
      m.set(j.job_date, arr);
    }
    return m;
  }, [filtered]);

  const dayJobs = selectedDay ? (byDay.get(fmtDate(selectedDay)) || []) : [];

  const uniques = useMemo(() => ({
    techs: [...new Set(jobs.map((j) => j.tech_name).filter(Boolean) as string[])].sort(),
    statuses: [...new Set(jobs.map((j) => j.status).filter(Boolean) as string[])].sort(),
    companies: [...new Set(jobs.flatMap((j) => [j.company_1, j.company]).filter(Boolean) as string[])].sort(),
  }), [jobs]);

  const scheduledDays = useMemo(() => {
    const dates: Date[] = [];
    for (const k of byDay.keys()) {
      const [y, m, d] = k.split("-").map(Number);
      if (y && m && d) dates.push(new Date(y, m - 1, d));
    }
    return dates;
  }, [byDay]);

  async function onDropToDay(day: Date) {
    if (!dragJobId) return;
    const newDate = fmtDate(day);
    const job = jobs.find((j) => j.id === dragJobId);
    setDragJobId(null);
    if (!job || job.job_date === newDate) return;
    const { error } = await (supabase as any)
      .from("jobs")
      .update({ job_date: newDate, notified_at: null })
      .eq("id", job.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Rescheduled to ${newDate}`);
    load();
  }

  async function toggleNotif(job: Job) {
    const { error } = await (supabase as any)
      .from("jobs")
      .update({ notify_enabled: !(job.notify_enabled ?? true) })
      .eq("id", job.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-2">
          <MobileNav className="lg:hidden" />
          <Link to="/" className="hidden lg:inline-flex">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Schedule</h1>
            <p className="text-xs text-muted-foreground">Drag a job to a day to reschedule. Click to edit or change reminders.</p>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {canViewAll && (
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Tech" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All techs</SelectItem>
                {uniques.techs.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {uniques.statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Company" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {uniques.companies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-4 lg:gap-6">
          <div className="bg-card border rounded-xl p-2 sm:p-3 w-full lg:w-auto">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={setSelectedDay}
              modifiers={{ scheduled: scheduledDays }}
              modifiersClassNames={{
                scheduled: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary",
              }}
              components={{
                Day: ({ day, children, ...rest }: any) => (
                  <td
                    {...rest}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={() => onDropToDay(day.date)}
                  >
                    {children}
                  </td>
                ),
              }}
              className="pointer-events-auto"
            />
          </div>

          <div className="bg-card border rounded-xl p-3 sm:p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                {selectedDay ? selectedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "Pick a day"}
              </h2>
              <Badge variant="secondary">{dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}</Badge>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
            ) : dayJobs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No jobs on this day.</div>
            ) : (
              <ul className="space-y-2">
                {dayJobs
                  .slice()
                  .sort((a, b) => (a.job_time || "").localeCompare(b.job_time || ""))
                  .map((j) => (
                    <li
                      key={j.id}
                      draggable
                      onDragStart={() => setDragJobId(j.id)}
                      onDragEnd={() => setDragJobId(null)}
                      onClick={() => { setEditing(j); setDialogOpen(true); }}
                      className="border rounded-md p-3 hover:bg-accent cursor-pointer flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="shrink-0">{(j.job_time || "—").slice(0, 5)}</span>
                          <span className="truncate">{j.tech_name || "Unassigned"} · {j.job_type || "Job"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {j.company || j.company_1 || "—"} · {j.address || "no address"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Status: {j.status} · ${Number(j.price || 0).toFixed(0)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleNotif(j); }}
                        className="p-1.5 rounded hover:bg-background shrink-0"
                        title={j.notify_enabled ? "Disable reminders" : "Enable reminders"}
                      >
                        {j.notify_enabled ?? true
                          ? <Bell className="h-4 w-4 text-primary" />
                          : <BellOff className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      <RescheduleDialog
        job={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
      />
    </div>
  );
}
