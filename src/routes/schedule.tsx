import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bell, BellOff, ArrowLeft, Clock, Pencil, Trash2, Plus } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { RescheduleDialog } from "@/components/schedule/RescheduleDialog";
import { JobDialog } from "@/components/AddJobDialog";
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
  const { canViewAll, isAdmin, isManager } = useAuth();
  const canDelete = isAdmin || isManager;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [techFilter, setTechFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [editing, setEditing] = useState<Job | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingFull, setEditingFull] = useState<Job | null>(null);
  const [fullEditOpen, setFullEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
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
      .update({ job_date: newDate, notified_at: null, notified_lead_minutes: [] })
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from("jobs").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Job deleted");
    setDeleteTarget(null);
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
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Schedule</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Drag a job to a day to reschedule. Click to edit reminders.</p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New job
          </Button>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div className="bg-card border rounded-xl p-3 sm:p-4">
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
              className="pointer-events-auto w-full [--cell-size:2.75rem] sm:[--cell-size:3.25rem]"
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
                      className="border rounded-md p-3 hover:bg-accent/40 flex items-start justify-between gap-2"
                    >
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => { setEditing(j); setDialogOpen(true); }}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="shrink-0">
                            {(j.job_time || "—").slice(0, 5)}
                            {j.job_time_end ? ` – ${j.job_time_end.slice(0, 5)}` : ""}
                          </span>
                          <span className="truncate">{j.tech_name || "Unassigned"} · {j.job_type || "Job"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {j.company || j.company_1 || "—"} · {j.address || "no address"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Status: {j.status} · ${Number(j.price || 0).toFixed(0)}
                          {j.notify_lead_minutes_list && j.notify_lead_minutes_list.length > 1 && (
                            <> · {j.notify_lead_minutes_list.length} reminders</>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleNotif(j); }}
                          className="p-1.5 rounded hover:bg-background"
                          title={j.notify_enabled ? "Disable reminders" : "Enable reminders"}
                        >
                          {j.notify_enabled ?? true
                            ? <Bell className="h-4 w-4 text-primary" />
                            : <BellOff className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingFull(j); setFullEditOpen(true); }}
                          className="p-1.5 rounded hover:bg-background"
                          title="Edit job"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(j); }}
                            className="p-1.5 rounded hover:bg-background"
                            title="Delete job"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </button>
                        )}
                      </div>
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

      {addOpen && (
        <JobDialog
          onJobSaved={() => { load(); setAddOpen(false); }}
          open={addOpen}
          onOpenChange={setAddOpen}
          prefill={{ job_date: selectedDay ? fmtDate(selectedDay) : "" }}
          trigger={<span className="hidden" />}
        />
      )}

      {fullEditOpen && editingFull && (
        <JobDialog
          job={editingFull as any}
          onJobSaved={() => { load(); setFullEditOpen(false); setEditingFull(null); }}
          open={fullEditOpen}
          onOpenChange={(o) => { setFullEditOpen(o); if (!o) setEditingFull(null); }}
          trigger={<span className="hidden" />}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the job
              {deleteTarget ? ` for ${deleteTarget.company || deleteTarget.company_1 || "—"} on ${deleteTarget.job_date || "—"}` : ""}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
