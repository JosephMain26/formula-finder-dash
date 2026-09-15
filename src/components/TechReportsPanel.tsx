import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerField } from "@/components/DatePickerField";
import { FileDown, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";
import { money, resolveSpecRange, DEFAULT_REPORT_SPEC, type ReportDateMode } from "@/lib/reportSpec";
import { loadStatuses, type StatusDef } from "@/lib/jobSchema";
import {
  summarizeByTech, renderTechReportHtml, techRangeText, TECH_DATE_MODES,
  type TechReportSummary,
} from "@/lib/techReport";
import { sendAutomationEmail } from "@/lib/automationEmail.functions";

type Job = Tables<"jobs">;

type TechRow = { id: string; tech_name: string; email: string | null };

export function TechReportsPanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [techs, setTechs] = useState<TechRow[]>([]);
  const [statusDefs, setStatusDefs] = useState<StatusDef[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTech, setSelectedTech] = useState<string>("__all__");
  const [dateMode, setDateMode] = useState<ReportDateMode>("last-week");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statuses, setStatuses] = useState<string[]>(["Completed"]);
  const [sending, setSending] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: jobsData }, { data: techData }, { data: profs }] = await Promise.all([
        supabase.from("jobs").select("*").order("job_date", { ascending: false }),
        supabase.from("technicians").select("id, tech_name, user_id"),
        supabase.from("profiles").select("id, email"),
      ]);
      const emailById = new Map((profs || []).map((p: any) => [p.id, p.email as string | null]));
      setJobs((jobsData as Job[]) || []);
      setTechs(
        ((techData as any[]) || [])
          .map((t) => ({
            id: t.id,
            tech_name: (t.tech_name || "").trim(),
            email: t.user_id ? emailById.get(t.user_id) ?? null : null,
          }))
          .filter((t) => t.tech_name)
          .sort((a, b) => a.tech_name.localeCompare(b.tech_name))
      );
      setLoading(false);
    })();
    loadStatuses().then(setStatusDefs).catch(() => {});
  }, []);

  const range = useMemo(
    () => resolveSpecRange({ ...DEFAULT_REPORT_SPEC, dateMode, dateFrom, dateTo }, new Date()),
    [dateMode, dateFrom, dateTo]
  );
  const rangeText = techRangeText(range?.from, range?.to);

  const summaries = useMemo(
    () =>
      summarizeByTech(jobs, {
        from: range?.from,
        to: range?.to,
        statuses,
        techNames: selectedTech === "__all__" ? [] : [selectedTech],
      }),
    [jobs, range, statuses, selectedTech]
  );

  const emailFor = (tech: string) => techs.find((t) => t.tech_name === tech)?.email || null;

  function toggleStatus(name: string) {
    setStatuses((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  }

  function downloadPdf(list: TechReportSummary[]) {
    if (!list.length) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    list.forEach((s, idx) => {
      if (idx > 0) doc.addPage();
      let y = 16;
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(`Technician Report — ${s.tech}`, 14, y); y += 6;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`${rangeText} · ${s.jobsCount} job${s.jobsCount === 1 ? "" : "s"}`, 14, y); y += 7;
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(
        `Tech cut: ${money(s.techCut)}     Owed to office: ${money(s.officeCut)}     Revenue: ${money(s.revenue)}`,
        14, y
      );
      doc.setFont("helvetica", "normal"); y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Date", "Marketer", "Type", "Status", "Price", "Tech cut", "Office cut"]],
        body: s.rows.map((r) => [
          r.job.job_date || "—",
          (r.job.company_1 || r.job.company || "—").trim() || "—",
          r.job.job_type || "—",
          r.job.status || "—",
          money(r.revenue),
          money(r.techCut),
          money(r.officeCut),
        ]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [60, 60, 60] },
        margin: { left: 8, right: 8 },
      });
    });
    const name = list.length === 1 ? list[0].tech.replace(/\s+/g, "-").toLowerCase() : "all-techs";
    doc.save(`tech-report-${name}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function emailTech(s: TechReportSummary) {
    const to = emailFor(s.tech);
    if (!to) { toast.error("This technician has no linked account email"); return; }
    setSending(s.tech);
    try {
      await sendAutomationEmail({
        data: {
          to,
          subject: `Your report — ${rangeText}`,
          html: renderTechReportHtml(s, rangeText),
        },
      });
      toast.success(`Sent to ${to}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending("");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Report settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Technician</Label>
              <Select value={selectedTech} onValueChange={setSelectedTech}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All technicians (separate report each)</SelectItem>
                  {techs.map((t) => <SelectItem key={t.id} value={t.tech_name}>{t.tech_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date range</Label>
              <Select value={dateMode} onValueChange={(v) => setDateMode(v as ReportDateMode)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TECH_DATE_MODES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {dateMode === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <DatePickerField value={dateFrom} onChange={setDateFrom} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <DatePickerField value={dateTo} onChange={setDateTo} />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Job statuses ({statuses.length === 0 ? "All" : statuses.length})</Label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setStatuses(statusDefs.map((s) => s.name))}>All</button>
                <button type="button" className="text-primary hover:underline" onClick={() => setStatuses([])}>None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1 max-h-32 overflow-y-auto border rounded p-2">
              {statusDefs.length === 0 && <span className="text-xs text-muted-foreground col-span-3">No statuses.</span>}
              {statusDefs.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={statuses.includes(s.name)} onCheckedChange={() => toggleStatus(s.name)} />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">No selection = include all statuses.</p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => downloadPdf(summaries)} disabled={!summaries.length}>
              <FileDown className="h-4 w-4 mr-2" /> Download PDF{summaries.length > 1 ? ` (${summaries.length})` : ""}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : summaries.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No jobs match these settings.</CardContent></Card>
      ) : (
        summaries.map((s) => {
          const to = emailFor(s.tech);
          return (
            <Card key={s.tech}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-base">{s.tech}</CardTitle>
                    <p className="text-xs text-muted-foreground">{rangeText} · {s.jobsCount} job{s.jobsCount === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadPdf([s])}>
                      <FileDown className="h-4 w-4 mr-1" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => emailTech(s)} disabled={!to || sending === s.tech}>
                      {sending === s.tech ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                      Email
                    </Button>
                  </div>
                </div>
                {!to && <p className="text-xs text-muted-foreground">No linked account email — connect this technician to a login to email their report.</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded border p-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Tech cut</div>
                    <div className="text-lg font-semibold text-emerald-600">{money(s.techCut)}</div>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Owed to office</div>
                    <div className="text-lg font-semibold text-destructive">{money(s.officeCut)}</div>
                  </div>
                  <div className="rounded border p-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Revenue</div>
                    <div className="text-lg font-semibold">{money(s.revenue)}</div>
                  </div>
                </div>
                <div className="-mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-1.5 pr-2">Date</th>
                        <th className="py-1.5 pr-2">Marketer</th>
                        <th className="py-1.5 pr-2">Type</th>
                        <th className="py-1.5 pr-2">Status</th>
                        <th className="py-1.5 pr-2 text-right">Price</th>
                        <th className="py-1.5 pr-2 text-right">Tech cut</th>
                        <th className="py-1.5 text-right">Office cut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.map((r) => (
                        <tr key={r.job.id} className="border-b last:border-0">
                          <td className="py-1.5 pr-2">{r.job.job_date || "—"}</td>
                          <td className="py-1.5 pr-2">{(r.job.company_1 || r.job.company || "—").trim() || "—"}</td>
                          <td className="py-1.5 pr-2">{r.job.job_type || "—"}</td>
                          <td className="py-1.5 pr-2">{r.job.status || "—"}</td>
                          <td className="py-1.5 pr-2 text-right">{money(r.revenue)}</td>
                          <td className="py-1.5 pr-2 text-right">{money(r.techCut)}</td>
                          <td className="py-1.5 text-right">{money(r.officeCut)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
