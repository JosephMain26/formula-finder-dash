import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerField } from "@/components/DatePickerField";
import { FileDown, Mail, Loader2, Save, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Tables } from "@/integrations/supabase/types";
import { money, resolveSpecRange, DEFAULT_REPORT_SPEC, type ReportDateMode } from "@/lib/reportSpec";
import { loadStatuses, type StatusDef } from "@/lib/jobSchema";
import {
  summarizeByTech, renderTechReportHtml, techRangeText, techCellValue, TECH_DATE_MODES,
  TECH_BOXES, TECH_COLUMNS, DEFAULT_TECH_BOXES, DEFAULT_TECH_COLUMNS, DEFAULT_TECH_TITLE,
  type TechReportSummary,
} from "@/lib/techReport";
import { sendAutomationEmail } from "@/lib/automationEmail.functions";
import {
  loadTechReportTemplates, saveTechReportTemplates,
  type TechReportTemplate, type TechReportTemplateSpec,
} from "@/lib/settings";

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
  const [title, setTitle] = useState(DEFAULT_TECH_TITLE);
  const [boxes, setBoxes] = useState<string[]>(DEFAULT_TECH_BOXES);
  const [columns, setColumns] = useState<string[]>(DEFAULT_TECH_COLUMNS);
  const [sending, setSending] = useState<string>("");

  const [templates, setTemplates] = useState<TechReportTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("__none__");

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
    loadTechReportTemplates().then(setTemplates).catch(() => {});
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

  const visibleColumns = TECH_COLUMNS.filter((c) => columns.includes(c.key));
  const visibleBoxes = TECH_BOXES.filter((b) => boxes.includes(b.key));
  const boxValues = (s: TechReportSummary): Record<string, number> => ({
    techCut: s.techCut, officeCut: s.officeCut, revenue: s.revenue,
  });

  const emailFor = (tech: string) => techs.find((t) => t.tech_name === tech)?.email || null;

  function toggleStatus(name: string) {
    setStatuses((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  }
  function toggleIn(list: string[], set: (v: string[]) => void, key: string) {
    set(list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);
  }

  // ---------- templates ----------
  const currentSpec = (): TechReportTemplateSpec => ({
    tech: selectedTech, dateMode, dateFrom, dateTo, statuses, title, boxes, columns,
  });

  function applySpec(spec: TechReportTemplateSpec) {
    setSelectedTech(spec.tech || "__all__");
    setDateMode((spec.dateMode || "last-week") as ReportDateMode);
    setDateFrom(spec.dateFrom || "");
    setDateTo(spec.dateTo || "");
    setStatuses(Array.isArray(spec.statuses) ? spec.statuses : []);
    setTitle(spec.title || DEFAULT_TECH_TITLE);
    setBoxes(spec.boxes?.length ? spec.boxes : DEFAULT_TECH_BOXES);
    setColumns(spec.columns?.length ? spec.columns : DEFAULT_TECH_COLUMNS);
  }

  async function persist(list: TechReportTemplate[]) {
    setTemplates(list);
    try {
      await saveTechReportTemplates(list);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save templates");
    }
  }

  function pickTemplate(id: string) {
    setTemplateId(id);
    if (id === "__none__") return;
    const t = templates.find((x) => x.id === id);
    if (t) applySpec(t.spec);
  }

  async function saveAsNew() {
    const name = window.prompt("Template name")?.trim();
    if (!name) return;
    const t: TechReportTemplate = { id: crypto.randomUUID(), name, spec: currentSpec() };
    await persist([...templates, t]);
    setTemplateId(t.id);
    toast.success("Template saved");
  }

  async function saveCurrent() {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return saveAsNew();
    await persist(templates.map((x) => (x.id === t.id ? { ...x, spec: currentSpec() } : x)));
    toast.success("Template updated");
  }

  async function renameCurrent() {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const name = window.prompt("New name", t.name)?.trim();
    if (!name) return;
    await persist(templates.map((x) => (x.id === t.id ? { ...x, name } : x)));
  }

  async function deleteCurrent() {
    const t = templates.find((x) => x.id === templateId);
    if (!t || !window.confirm(`Delete template "${t.name}"?`)) return;
    await persist(templates.filter((x) => x.id !== t.id));
    setTemplateId("__none__");
  }

  function downloadPdf(list: TechReportSummary[]) {
    if (!list.length) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    list.forEach((s, idx) => {
      if (idx > 0) doc.addPage();
      let y = 16;
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(`${title} — ${s.tech}`, 14, y); y += 6;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`${rangeText} · ${s.jobsCount} job${s.jobsCount === 1 ? "" : "s"}`, 14, y); y += 7;
      const vals = boxValues(s);
      if (visibleBoxes.length) {
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text(visibleBoxes.map((b) => `${b.label}: ${money(vals[b.key])}`).join("     "), 14, y);
        doc.setFont("helvetica", "normal"); y += 6;
      }
      autoTable(doc, {
        startY: y,
        head: [visibleColumns.map((c) => c.label)],
        body: s.rows.map((r) => visibleColumns.map((c) => techCellValue(r, c.key))),
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
          subject: `${title} — ${rangeText}`,
          html: renderTechReportHtml(s, rangeText, { title, boxes, columns }),
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
          {/* Template bar */}
          <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2">
            <div className="min-w-[180px] flex-1">
              <Label className="text-xs">Template</Label>
              <Select value={templateId} onValueChange={pickTemplate}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No template</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={saveCurrent} disabled={templateId === "__none__"}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
            <Button size="sm" variant="outline" onClick={saveAsNew}>
              <Plus className="h-4 w-4 mr-1" /> Save as new
            </Button>
            <Button size="sm" variant="outline" onClick={renameCurrent} disabled={templateId === "__none__"}>
              <Pencil className="h-4 w-4 mr-1" /> Rename
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={deleteCurrent} disabled={templateId === "__none__"}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>

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
            <Label className="text-xs">Report title</Label>
            <Input className="h-9" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={DEFAULT_TECH_TITLE} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Summary boxes</Label>
              <div className="grid gap-1.5 mt-1 border rounded p-2">
                {TECH_BOXES.map((b) => (
                  <label key={b.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={boxes.includes(b.key)} onCheckedChange={() => toggleIn(boxes, setBoxes, b.key)} />
                    <span>{b.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Table columns</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1 border rounded p-2">
                {TECH_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={columns.includes(c.key)} onCheckedChange={() => toggleIn(columns, setColumns, c.key)} />
                    <span className="truncate">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

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
          const vals = boxValues(s);
          const boxColor: Record<string, string> = {
            techCut: "text-emerald-600", officeCut: "text-destructive", revenue: "",
          };
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
                {visibleBoxes.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {visibleBoxes.map((b) => (
                      <div key={b.key} className="rounded border p-2">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{b.label}</div>
                        <div className={`text-lg font-semibold ${boxColor[b.key]}`}>{money(vals[b.key])}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="-mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        {visibleColumns.map((c) => (
                          <th key={c.key} className={`py-1.5 pr-2 ${c.numeric ? "text-right" : ""}`}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.rows.map((r) => (
                        <tr key={r.job.id} className="border-b last:border-0">
                          {visibleColumns.map((c) => (
                            <td key={c.key} className={`py-1.5 pr-2 ${c.numeric ? "text-right" : ""}`}>
                              {techCellValue(r, c.key)}
                            </td>
                          ))}
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
