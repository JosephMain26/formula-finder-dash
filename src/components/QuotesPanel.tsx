import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, NotebookPen, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { JobDialog } from "@/components/AddJobDialog";
import { StatusBadge } from "@/components/StatusBadge";
import {
  isOpenJob, isQuoteJob, nextFollowup, followupState, quotedAt, daysSince, addDays, todayStr,
  loadFollowupDelay, saveFollowupDelay, type FollowupEntry,
} from "@/lib/quotes";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;
export type QuotesMode = "open" | "quotes";

const stateCls = {
  overdue: "border-l-4 border-l-destructive",
  today: "border-l-4 border-l-chart-4",
  upcoming: "border-l-4 border-l-muted",
};

export function QuotesPanel({ mode, onClose, jobs, onChanged }: {
  mode: QuotesMode | null; onClose: () => void; jobs: Job[]; onChanged: () => void;
}) {
  const [delay, setDelay] = useState(2);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [custom, setCustom] = useState("");
  useEffect(() => { loadFollowupDelay().then(setDelay); }, []);

  const rows = useMemo(() => {
    const list = jobs.filter(mode === "quotes" ? isQuoteJob : isOpenJob);
    return list
      .map((j) => ({ j, next: nextFollowup(j, delay) }))
      .sort((a, b) => a.next.localeCompare(b.next));
  }, [jobs, mode, delay]);

  async function patch(j: Job, extra: Record<string, any>, status?: string) {
    const ef = { ...((j as any).extra_fields || {}), ...extra };
    const upd: any = { extra_fields: ef };
    if (status) upd.status = status;
    const { error } = await supabase.from("jobs").update(upd).eq("id", j.id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  async function logFollowup(j: Job, days: number | string) {
    const next = typeof days === "number" ? addDays(todayStr(), days) : days;
    if (!next) return toast.error("Pick a date");
    const log: FollowupEntry[] = [...(((j as any).extra_fields?.followup_log) || []), { at: new Date().toISOString(), note }];
    await patch(j, { followup_log: log, followup_next: next, quoted_at: quotedAt(j) });
    setLogFor(null); setNote(""); setCustom("");
    toast.success(`Next follow-up ${next}`);
  }

  async function markLost(j: Job) {
    const reason = window.prompt("Reason lost (optional)") ?? "";
    await patch(j, { lost_reason: reason }, "Cancelled");
  }

  return (
    <Sheet open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{mode === "quotes" ? "Quotes given" : "Open jobs"} ({rows.length})</SheetTitle>
        </SheetHeader>
        {mode === "quotes" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            Default follow-up after
            <Input type="number" min={1} className="h-7 w-16" value={delay}
              onChange={(e) => setDelay(Math.max(1, Number(e.target.value) || 1))}
              onBlur={() => saveFollowupDelay(delay)} />
            days
          </div>
        )}
        <div className="space-y-2 mt-4">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
          {rows.map(({ j, next }) => {
            const st = followupState(next);
            const q = isQuoteJob(j);
            const log: FollowupEntry[] = (j as any).extra_fields?.followup_log || [];
            return (
              <div key={j.id} className={`rounded-md border bg-card p-3 ${q ? stateCls[st] : ""}`}>
                <button className="w-full text-left" onClick={() => setEditJob(j)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{j.company || j.company_1 || "—"} · {j.job_type || "Job"}</span>
                    <StatusBadge status={j.status} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{j.address || "No address"}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                    {j.phone_no && <span>{j.phone_no}</span>}
                    {j.price != null && <span>${Number(j.price).toLocaleString()}</span>}
                    {q && <span>Quoted {quotedAt(j)} ({daysSince(quotedAt(j))}d ago)</span>}
                    {q && <span className={st === "overdue" ? "text-destructive font-medium" : st === "today" ? "text-chart-4 font-medium" : ""}>Follow-up {next}</span>}
                    {log.length > 0 && <span>{log.length} follow-ups</span>}
                  </div>
                </button>
                {q && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {j.phone_no && <Button asChild size="sm" variant="outline"><a href={`tel:${j.phone_no}`}><Phone className="h-3.5 w-3.5" /></a></Button>}
                    {j.phone_no && <Button asChild size="sm" variant="outline"><a href={`sms:${j.phone_no}`}><MessageSquare className="h-3.5 w-3.5" /></a></Button>}
                    <Button size="sm" variant="outline" onClick={() => setLogFor(logFor === j.id ? null : j.id)}><NotebookPen className="h-3.5 w-3.5 mr-1" />Log</Button>
                    <Button size="sm" variant="outline" onClick={() => patch(j, {}, "Scheduled")}><Check className="h-3.5 w-3.5 mr-1" />Won</Button>
                    <Button size="sm" variant="outline" onClick={() => markLost(j)}><X className="h-3.5 w-3.5 mr-1" />Lost</Button>
                  </div>
                )}
                {logFor === j.id && (
                  <div className="mt-2 space-y-2">
                    <Input placeholder="What happened?" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-xs text-muted-foreground">Next:</span>
                      {[1, 3, 7].map((d) => <Button key={d} size="sm" variant="secondary" onClick={() => logFollowup(j, d)}>+{d}d</Button>)}
                      <Input type="date" className="h-8 w-36" value={custom} onChange={(e) => setCustom(e.target.value)} />
                      <Button size="sm" onClick={() => logFollowup(j, custom)}>Save</Button>
                    </div>
                    {log.slice(-3).reverse().map((l, i) => (
                      <div key={i} className="text-xs text-muted-foreground">{l.at.slice(0, 10)} — {l.note || "(no note)"}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {editJob && (
          <JobDialog job={editJob} open onOpenChange={(o) => !o && setEditJob(null)}
            onJobSaved={() => { setEditJob(null); onChanged(); }} trigger={<span />} />
        )}
      </SheetContent>
    </Sheet>
  );
}

export function QuoteCards({ jobs, onOpen }: { jobs: Job[]; onOpen: (m: QuotesMode) => void }) {
  const [delay, setDelay] = useState(2);
  useEffect(() => { loadFollowupDelay().then(setDelay); }, []);
  const open = jobs.filter(isOpenJob).length;
  const quotes = jobs.filter(isQuoteJob);
  const due = quotes.filter((j) => followupState(nextFollowup(j, delay)) !== "upcoming").length;
  return (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => onOpen("open")} className="rounded-lg border bg-card p-3 text-left hover:ring-2 hover:ring-primary transition">
        <div className="text-xs text-muted-foreground">Open jobs</div>
        <div className="text-2xl font-bold">{open}</div>
        <div className="text-xs text-muted-foreground">Tap to view</div>
      </button>
      <button onClick={() => onOpen("quotes")} className="rounded-lg border bg-card p-3 text-left hover:ring-2 hover:ring-primary transition">
        <div className="text-xs text-muted-foreground">Quotes given</div>
        <div className="text-2xl font-bold">{quotes.length}</div>
        {due > 0 ? <Badge variant="destructive" className="mt-1">{due} follow-up due</Badge> : <div className="text-xs text-muted-foreground">No follow-ups due</div>}
      </button>
    </div>
  );
}
