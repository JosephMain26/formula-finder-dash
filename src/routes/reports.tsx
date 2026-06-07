import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, FileDown, GripVertical, Save, Plus, Trash2, Pencil, Clock } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { DatePickerField } from "@/components/DatePickerField";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tables } from "@/integrations/supabase/types";
import {
  DEFAULT_REPORT_SPEC, REPORT_COLUMNS, REPORT_SECTION_LABELS, TOTAL_LABELS,
  computeReportData, money,
  type ReportSpec, type ReportSectionId, type ReportColumnKey, type TotalKey, type ReportDateMode,
} from "@/lib/reportSpec";
import { loadTemplates, saveTemplates, makeId, type TemplatesSetting, type ReportTemplate } from "@/lib/settings";
import { loadPartsCharges, type PartsCharge } from "@/lib/partsCharges";
import { loadStatuses, type StatusDef } from "@/lib/jobSchema";
import {
  loadAutomations, upsertAutomation, deleteAutomation,
  type ReportAutomation, type AutomationFreq,
} from "@/lib/reportAutomations";
import { BalancesPanel } from "@/components/BalancesPanel";



type Job = Tables<"jobs">;

const ROLE_OPTIONS = [
  { key: "admin", label: "Admin" },
  { key: "manager", label: "Manager" },
  { key: "tech", label: "Tech" },
  { key: "user", label: "User" },
];

const DATE_MODES: { key: ReportDateMode; label: string }[] = [
  { key: "all", label: "All dates" },
  { key: "custom", label: "Custom dates" },
  { key: "today", label: "Today" },
  { key: "this-week", label: "This week (Mon–Sun)" },
  { key: "last-week", label: "Last week (Mon–Sun)" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "this-year", label: "This year" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reports & Balances - Jobs Dashboard" },
      { name: "description", content: "Build custom job reports, review marketer balances, and schedule automated report delivery." },
    ],
  }),
});

function SortableSectionRow({
  id, label, enabled, onToggle, children,
}: {
  id: ReportSectionId; label: string; enabled: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="border rounded-md bg-background">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" type="button" aria-label="Drag">
          <GripVertical className="h-4 w-4" />
        </button>
        <Checkbox checked={enabled} onCheckedChange={onToggle} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {enabled && children ? <div className="px-3 pb-2 pl-9">{children}</div> : null}
    </div>
  );
}

function pdfFromSpec(jobs: Job[], spec: ReportSpec, partsCharges: PartsCharge[] = []) {
  const data = computeReportData(jobs, spec, new Date(), partsCharges);
  const doc = new jsPDF({ orientation: "landscape" });
  let y = 14;

  for (const section of spec.sections) {
    if (!section.enabled) continue;

    if (section.id === "title") {
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(spec.title || "Jobs Report", 14, y); y += 7;
    }
    if (section.id === "range") {
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(data.rangeText, 14, y); y += 5;
      doc.setFontSize(9);
      doc.text(`Total jobs: ${data.jobCount}`, 14, y); y += 6;
    }
    if (section.id === "totals") {
      const cells: string[] = [];
      if (spec.totals.revenue) cells.push(`Revenue: ${money(data.totals.revenue)}`);
      if (spec.totals.tech) cells.push(`Tech: ${money(data.totals.tech)}`);
      if (spec.totals.office) cells.push(`Office: ${money(data.totals.office)}`);
      if (spec.totals.marketer) cells.push(`Marketer: ${money(data.totals.marketer)}`);
      if (cells.length) {
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text(cells.join("    "), 14, y);
        doc.setFont("helvetica", "normal"); y += 6;
      }
    }
    if (section.id === "balance") {
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Balance summary", 14, y); doc.setFont("helvetica", "normal"); y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Marketer", "Jobs", "Earned", "Net", "Status"]],
        body: data.balanceSummaries.map((s) => [
          s.marketer, String(s.jobsCount), money(s.totalEarned), money(s.net),
          Math.abs(s.net) < 0.005 ? "Settled" : s.net > 0 ? "Office owes marketer" : "Marketer owes office",
        ]),
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: { fillColor: [60, 60, 60] },
        margin: { left: 8, right: 8 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(`Total net: ${money(data.balanceGrandNet)}`, 14, y);
      doc.setFont("helvetica", "normal"); y += 6;
    }
    if (section.id === "table") {
      autoTable(doc, {
        startY: y,
        head: [data.tableColumns.map((c) => c.label)],
        body: data.tableRows,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [60, 60, 60] },
        margin: { left: 8, right: 8 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (y > doc.internal.pageSize.getHeight() - 20 && section.id !== "table") {
      doc.addPage(); y = 14;
    }
  }

  doc.save(`jobs-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function ReportsPage() {
  const { tab } = Route.useSearch();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<StatusDef[]>([]);
  const [loading, setLoading] = useState(true);

  // Builder spec
  const [spec, setSpec] = useState<ReportSpec>(DEFAULT_REPORT_SPEC);

  // Templates
  const [templates, setTemplates] = useState<TemplatesSetting>({ dashboardViews: [], exportTemplates: [], reportTemplates: [] });
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");

  // Automations
  const [automations, setAutomations] = useState<ReportAutomation[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("jobs").select("*").order("job_date", { ascending: false });
      const list = (data as Job[]) || [];
      setJobs(list);
      const co = [...new Set(list.map((j) => (j.company_1 || j.company || "").trim()).filter(Boolean))].sort();
      setCompanies(co);
      setLoading(false);
    })();
    loadTemplates().then(setTemplates);
    loadStatuses().then(setStatuses).catch(() => {});
    loadAutomations().then(setAutomations).catch(() => {});
  }, []);

  const reportTemplates = templates.reportTemplates || [];

  // ---- Spec mutation helpers ----
  function patch(p: Partial<ReportSpec>) { setSpec((s) => ({ ...s, ...p })); }
  function toggleSection(id: ReportSectionId) {
    setSpec((s) => ({ ...s, sections: s.sections.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)) }));
  }
  function onSectionDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSpec((s) => {
      const oldI = s.sections.findIndex((x) => x.id === active.id);
      const newI = s.sections.findIndex((x) => x.id === over.id);
      return { ...s, sections: arrayMove(s.sections, oldI, newI) };
    });
  }
  function toggleTotal(k: TotalKey) {
    setSpec((s) => ({ ...s, totals: { ...s.totals, [k]: !s.totals[k] } }));
  }
  function toggleColumn(k: ReportColumnKey) {
    setSpec((s) => {
      const has = s.columns.includes(k);
      return { ...s, columns: has ? s.columns.filter((c) => c !== k) : [...s.columns, k] };
    });
  }
  function toggleMarketer(name: string) {
    setSpec((s) => {
      const has = s.marketers.includes(name);
      return { ...s, marketers: has ? s.marketers.filter((m) => m !== name) : [...s.marketers, name] };
    });
  }
  function toggleStatus(name: string) {
    setSpec((s) => {
      const cur = s.statuses || [];
      const has = cur.includes(name);
      return { ...s, statuses: has ? cur.filter((x) => x !== name) : [...cur, name] };
    });
  }

  // ---- Templates ----
  function applyTemplate(id: string) {
    setActiveTemplateId(id);
    if (!id) return;
    const t = reportTemplates.find((x) => x.id === id);
    if (t?.spec) setSpec({ ...DEFAULT_REPORT_SPEC, ...(t.spec as ReportSpec) });
  }
  async function saveTemplate() {
    const name = newTemplateName.trim();
    if (!name) return;
    const tpl: ReportTemplate = { id: makeId(), name, spec };
    const next = { ...templates, reportTemplates: [...reportTemplates, tpl] };
    setTemplates(next);
    await saveTemplates(next);
    setActiveTemplateId(tpl.id);
    setNewTemplateName("");
    toast.success("Template saved");
  }
  async function deleteTemplate() {
    if (!activeTemplateId) return;
    const next = { ...templates, reportTemplates: reportTemplates.filter((t) => t.id !== activeTemplateId) };
    setTemplates(next);
    await saveTemplates(next);
    setActiveTemplateId("");
  }

  const previewData = useMemo(() => computeReportData(jobs, spec), [jobs, spec]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <MobileNav className="md:hidden" />
          <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex">
            <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Reports & Balances</h1>
            <p className="text-sm text-muted-foreground">Build custom reports, review marketer balances, and schedule automatic delivery</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue={tab === "balances" ? "balances" : tab === "automations" ? "automations" : "builder"}>
          <TabsList>
            <TabsTrigger value="builder">Report Builder</TabsTrigger>
            <TabsTrigger value="balances">Marketer Balances</TabsTrigger>
            <TabsTrigger value="automations">Automation Center</TabsTrigger>
          </TabsList>

          {/* ---------------- BALANCES ---------------- */}
          <TabsContent value="balances">
            <BalancesPanel />
          </TabsContent>


          {/* ---------------- BUILDER ---------------- */}
          <TabsContent value="builder" className="space-y-5">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Template</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Select value={activeTemplateId || "none"} onValueChange={(v) => applyTemplate(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Load a template…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {reportTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {activeTemplateId && (
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={deleteTemplate}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Save current as template…" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} className="h-9 flex-1" />
                  <Button variant="outline" size="sm" onClick={saveTemplate} disabled={!newTemplateName.trim()} className="h-9">
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Report title & range</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input value={spec.title} onChange={(e) => patch({ title: e.target.value })} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Date range</Label>
                    <Select value={spec.dateMode} onValueChange={(v) => patch({ dateMode: v as ReportDateMode })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DATE_MODES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {spec.dateMode === "custom" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">From</Label>
                        <DatePickerField value={spec.dateFrom || ""} onChange={(v) => patch({ dateFrom: v })} />
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <DatePickerField value={spec.dateTo || ""} onChange={(v) => patch({ dateTo: v })} />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{previewData.rangeText} · {previewData.jobCount} jobs</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Sections (drag to reorder)</CardTitle></CardHeader>
                <CardContent>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
                    <SortableContext items={spec.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1.5">
                        {spec.sections.map((s) => (
                          <SortableSectionRow key={s.id} id={s.id} label={REPORT_SECTION_LABELS[s.id]} enabled={s.enabled} onToggle={() => toggleSection(s.id)}>
                            {s.id === "totals" && (
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                {(Object.keys(TOTAL_LABELS) as TotalKey[]).map((k) => (
                                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <Checkbox checked={spec.totals[k]} onCheckedChange={() => toggleTotal(k)} />
                                    {TOTAL_LABELS[k]}
                                  </label>
                                ))}
                              </div>
                            )}
                          </SortableSectionRow>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Table columns ({spec.columns.length})</CardTitle>
                <div className="flex gap-2 text-xs">
                  <button className="text-primary hover:underline" onClick={() => patch({ columns: REPORT_COLUMNS.map((c) => c.key) })}>All</button>
                  <button className="text-primary hover:underline" onClick={() => patch({ columns: [] })}>None</button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {REPORT_COLUMNS.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={spec.columns.includes(c.key)} onCheckedChange={() => toggleColumn(c.key)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Marketers ({spec.marketers.length === 0 ? "All" : spec.marketers.length})</CardTitle>
                <div className="flex gap-2 text-xs">
                  <button className="text-primary hover:underline" onClick={() => patch({ marketers: [...companies] })}>All</button>
                  <button className="text-primary hover:underline" onClick={() => patch({ marketers: [] })}>None (= all)</button>
                </div>
              </CardHeader>
              <CardContent>
                {companies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No marketers found.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {companies.map((name) => (
                      <label key={name} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={spec.marketers.includes(name)} onCheckedChange={() => toggleMarketer(name)} />
                        <span className="truncate">{name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Job statuses ({(spec.statuses?.length ?? 0) === 0 ? "All" : spec.statuses!.length})</CardTitle>
                <div className="flex gap-2 text-xs">
                  <button className="text-primary hover:underline" onClick={() => patch({ statuses: statuses.map((s) => s.name) })}>All</button>
                  <button className="text-primary hover:underline" onClick={() => patch({ statuses: [] })}>None (= all)</button>
                </div>
              </CardHeader>
              <CardContent>
                {statuses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No statuses found.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {statuses.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={(spec.statuses || []).includes(s.name)} onCheckedChange={() => toggleStatus(s.name)} />
                        <span className="truncate">{s.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => pdfFromSpec(jobs, spec)} disabled={loading}>
                <FileDown className="h-4 w-4 mr-2" /> Generate PDF
              </Button>
            </div>
          </TabsContent>

          {/* ---------------- AUTOMATIONS ---------------- */}
          <TabsContent value="automations">
            <AutomationCenter
              automations={automations}
              setAutomations={setAutomations}
              reportTemplates={reportTemplates}
              companies={companies}
              statuses={statuses}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ============ Automation Center ============
const DATE_MODE_LABELS: Record<string, string> = Object.fromEntries(
  DATE_MODES.map((m) => [m.key, m.label])
);

function freqLabel(a: ReportAutomation): string {
  const s = a.schedule || ({} as any);
  const tz = s.tz ? ` ${s.tz}` : " UTC";
  const t = `${s.time || "08:00"}${tz}`;
  const range = DATE_MODE_LABELS[a.template?.dateMode] || "All dates";
  let when: string;
  if (s.freq === "daily") when = `Daily at ${t}`;
  else if (s.freq === "monthly") when = `Monthly on day ${s.monthDay ?? 1} at ${t}`;
  else when = `Weekly on ${WEEKDAYS[s.weekday ?? 1]} at ${t}`;
  return `${when} · ${range}${a.recipients?.perMarketer ? " · per marketer" : ""}`;
}


function AutomationCenter({
  automations, setAutomations, reportTemplates, companies, statuses,
}: {
  automations: ReportAutomation[];
  setAutomations: (a: ReportAutomation[]) => void;
  reportTemplates: ReportTemplate[];
  companies: string[];
  statuses: StatusDef[];
}) {
  const [editing, setEditing] = useState<ReportAutomation | null>(null);
  const [open, setOpen] = useState(false);

  function blank(): ReportAutomation {
    const tz = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
      catch { return "UTC"; }
    })();
    return {
      id: "",
      name: "",
      enabled: true,
      template: { ...DEFAULT_REPORT_SPEC },
      schedule: { freq: "weekly", weekday: 1, monthDay: 1, time: "08:00", tz },
      recipients: { roles: [], marketers: [], emails: [], perMarketer: false, sendToMarketer: false },
      last_run_at: null,
    };
  }

  async function toggleEnabled(a: ReportAutomation) {
    const saved = await upsertAutomation({ ...a, enabled: !a.enabled });
    setAutomations(automations.map((x) => (x.id === a.id ? saved : x)));
  }
  async function remove(a: ReportAutomation) {
    await deleteAutomation(a.id);
    setAutomations(automations.filter((x) => x.id !== a.id));
  }
  function startEdit(a: ReportAutomation) { setEditing({ ...a }); setOpen(true); }
  function startNew() { setEditing(blank()); setOpen(true); }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Name is required"); return; }
    const tz = editing.schedule.tz || (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
      catch { return "UTC"; }
    })();
    const toSave = { ...editing, schedule: { ...editing.schedule, tz } };
    try {
      const saved = await upsertAutomation(toSave);
      const exists = automations.some((x) => x.id === saved.id);
      setAutomations(exists ? automations.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...automations]);
      setOpen(false);
      toast.success("Automation saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Scheduled reports are emailed automatically to the recipients you choose.</p>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" /> New automation</Button>
      </div>

      {automations.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No automations yet. Create one to schedule report delivery.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {automations.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                <Switch checked={a.enabled} onCheckedChange={() => toggleEnabled(a)} />
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-sm">{a.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {freqLabel(a)}
                    {a.last_run_at && <span>· last run {new Date(a.last_run_at).toLocaleString()}</span>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => startEdit(a)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
                <Button variant="ghost" size="icon" onClick={() => remove(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit automation" : "New automation"}</DialogTitle></DialogHeader>
          {editing && (
            <AutomationForm editing={editing} setEditing={setEditing} reportTemplates={reportTemplates} companies={companies} statuses={statuses} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AutomationForm({
  editing, setEditing, reportTemplates, companies, statuses,
}: {
  editing: ReportAutomation;
  setEditing: (a: ReportAutomation) => void;
  reportTemplates: ReportTemplate[];
  companies: string[];
  statuses: StatusDef[];
}) {
  const sched = editing.schedule;
  const rec = editing.recipients;
  const tpl = editing.template;

  const localTz = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
    catch { return "UTC"; }
  })();
  const tz = sched.tz || localTz;

  function setSched(p: Partial<typeof sched>) { setEditing({ ...editing, schedule: { ...sched, ...p } }); }
  function setRec(p: Partial<typeof rec>) { setEditing({ ...editing, recipients: { ...rec, ...p } }); }
  function setTpl(p: Partial<ReportSpec>) { setEditing({ ...editing, template: { ...tpl, ...p } }); }
  function toggleRole(k: string) {
    setRec({ roles: rec.roles.includes(k) ? rec.roles.filter((r) => r !== k) : [...rec.roles, k] });
  }
  function toggleMarketer(name: string) {
    setRec({ marketers: rec.marketers.includes(name) ? rec.marketers.filter((m) => m !== name) : [...rec.marketers, name] });
  }
  function toggleStatus(name: string) {
    const cur = tpl.statuses || [];
    setTpl({ statuses: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name] });
  }
  function applyTemplate(id: string) {
    const t = reportTemplates.find((x) => x.id === id);
    if (t?.spec) setEditing({ ...editing, template: { ...DEFAULT_REPORT_SPEC, ...(t.spec as ReportSpec) } });
  }

  return (
    <div className="space-y-4 py-1">
      <div>
        <Label className="text-xs">Name</Label>
        <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9" />
      </div>

      <div>
        <Label className="text-xs">What to send (saved report template)</Label>
        <Select value="" onValueChange={applyTemplate}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Apply a report template…" /></SelectTrigger>
          <SelectContent>
            {reportTemplates.length === 0 && <SelectItem value="none" disabled>No templates — save one in Report Builder</SelectItem>}
            {reportTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Sections: {editing.template.sections.filter((s) => s.enabled).map((s) => REPORT_SECTION_LABELS[s.id]).join(", ") || "none"}
        </p>
      </div>

      <div>
        <Label className="text-xs">Report time range</Label>
        <Select value={tpl.dateMode} onValueChange={(v) => setTpl({ dateMode: v as ReportDateMode })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATE_MODES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {tpl.dateMode === "custom" ? (
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <Label className="text-xs">From</Label>
              <DatePickerField value={tpl.dateFrom || ""} onChange={(v) => setTpl({ dateFrom: v })} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <DatePickerField value={tpl.dateTo || ""} onChange={(v) => setTpl({ dateTo: v })} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            The window is recalculated each run (e.g. "Last week" always covers the previous Mon–Sun).
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Job statuses ({(tpl.statuses?.length ?? 0) === 0 ? "All" : tpl.statuses!.length})</Label>
          <div className="flex gap-2 text-xs">
            <button type="button" className="text-primary hover:underline" onClick={() => setTpl({ statuses: statuses.map((s) => s.name) })}>All</button>
            <button type="button" className="text-primary hover:underline" onClick={() => setTpl({ statuses: [] })}>None</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-32 overflow-y-auto border rounded p-2">
          {statuses.length === 0 && <span className="text-xs text-muted-foreground col-span-2">No statuses.</span>}
          {statuses.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={(tpl.statuses || []).includes(s.name)} onCheckedChange={() => toggleStatus(s.name)} />
              <span className="truncate">{s.name}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">No selection = include all statuses.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Frequency</Label>
          <Select value={sched.freq} onValueChange={(v) => setSched({ freq: v as AutomationFreq })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Time</Label>
          <Input type="time" value={sched.time} onChange={(e) => setSched({ time: e.target.value, tz })} className="h-9" />
        </div>
        {sched.freq === "weekly" && (
          <div className="col-span-2">
            <Label className="text-xs">Day of week</Label>
            <Select value={String(sched.weekday ?? 1)} onValueChange={(v) => setSched({ weekday: Number(v) })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {sched.freq === "monthly" && (
          <div className="col-span-2">
            <Label className="text-xs">Day of month</Label>
            <Input type="number" min={1} max={31} value={sched.monthDay ?? 1} onChange={(e) => setSched({ monthDay: Math.min(31, Math.max(1, Number(e.target.value))) })} className="h-9" />
          </div>
        )}
        <p className="col-span-2 text-xs text-muted-foreground">Times are in your timezone ({tz}).</p>
      </div>


      <div className="space-y-2 border-t pt-3">
        <Label className="text-sm font-medium">Recipients</Label>
        <div>
          <span className="text-xs text-muted-foreground">By role</span>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {ROLE_OPTIONS.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={rec.roles.includes(r.key)} onCheckedChange={() => toggleRole(r.key)} />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
          <Switch checked={rec.perMarketer} onCheckedChange={(v) => setRec({ perMarketer: v })} />
          Create a separate report for each marketer
        </label>

        {rec.perMarketer && (
          <label className="flex items-center gap-2 text-sm cursor-pointer pl-1 pt-1">
            <Switch checked={!!rec.sendToMarketer} onCheckedChange={(v) => setRec({ sendToMarketer: v })} />
            <span>
              Also send each marketer their own report
              <span className="block text-xs text-muted-foreground">to their contact email</span>
            </span>
          </label>
        )}

        {rec.perMarketer && (
          <p className="text-xs text-muted-foreground">
            {rec.sendToMarketer
              ? "Each marketer gets their own report, plus the recipients below receive a copy of every marketer's report."
              : "A report is built per marketer and sent only to the recipients you choose below (marketers get nothing)."}
          </p>
        )}

        <div>
          <span className="text-xs text-muted-foreground">
            {rec.perMarketer ? "Specific marketers to also receive their report (uses company email)" : "Specific marketers (uses company email)"}
          </span>
          <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-32 overflow-y-auto border rounded p-2">
            {companies.length === 0 && <span className="text-xs text-muted-foreground col-span-2">No marketers.</span>}
            {companies.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={rec.marketers.includes(name)} onCheckedChange={() => toggleMarketer(name)} />
                <span className="truncate">{name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs text-muted-foreground">Custom emails (one per line)</span>
          <Textarea
            value={rec.emails.join("\n")}
            onChange={(e) => setRec({ emails: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            rows={3}
            placeholder="boss@example.com"
            className="mt-1"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer border-t pt-3">
        <Switch checked={editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
        Enabled
      </label>
    </div>
  );
}
