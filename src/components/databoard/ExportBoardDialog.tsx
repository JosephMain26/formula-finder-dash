import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Save, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as htmlToImage from "html-to-image";
import JSZip from "jszip";
import { ALL_COLUMNS, type ColumnKey } from "@/components/ColumnToggle";
import {
  loadDataBoardPrefs, saveExportTemplates, makeId, DEFAULT_EXPORT_SECTIONS,
  type ExportTemplate, type ExportSectionId, type DataBoardFilters,
} from "@/lib/databoard/templates";
import type { Tables } from "@/integrations/supabase/types";
import type { DateRange } from "@/components/DateRangePresets";

type Job = Tables<"jobs">;

const SECTION_LABELS: Record<ExportSectionId, string> = {
  greeting: "Header / greeting",
  filters: "Active filters summary",
  kpis: "KPI cards snapshot",
  charts: "Charts snapshot",
  calendar: "Calendar snapshot",
  map: "Map snapshot",
  table: "Jobs table",
  appendix: "Appendix: full job list",
};

const EXPORTABLE_COLUMNS = ALL_COLUMNS.filter((c) => c.key !== "actions") as { key: ColumnKey; label: string }[];

type KpiKey = "revenue" | "profit" | "jobs" | "avg_ticket" | "tech_pay" | "marketer_pay" | "parts" | "tip" | "paid_count";
const ALL_KPIS: { key: KpiKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "profit", label: "Profit" },
  { key: "jobs", label: "Jobs" },
  { key: "avg_ticket", label: "Avg ticket" },
  { key: "tech_pay", label: "Tech pay" },
  { key: "marketer_pay", label: "Marketer pay" },
  { key: "parts", label: "Parts" },
  { key: "tip", label: "Tip" },
  { key: "paid_count", label: "Paid jobs" },
];
const DEFAULT_KPIS: KpiKey[] = ["revenue", "jobs", "avg_ticket", "tech_pay"];

function kpiCell(key: KpiKey, jobs: Job[]): string {
  const sum = (sel: (j: Job) => number) => jobs.reduce((a, j) => a + sel(j), 0);
  switch (key) {
    case "revenue": return `$${sum((j) => Number(j.price || 0)).toFixed(0)}`;
    case "profit": return `$${sum((j) => Number(j.price || 0) - Number(j.cost || 0) - Number(j.parts || 0) - Number(j.cc_fee || 0) - Number(j.total_tech || 0) - Number(j.total_marketer || 0)).toFixed(0)}`;
    case "jobs": return String(jobs.length);
    case "avg_ticket": return jobs.length ? `$${(sum((j) => Number(j.price || 0)) / jobs.length).toFixed(0)}` : "$0";
    case "tech_pay": return `$${sum((j) => Number(j.total_tech || 0)).toFixed(0)}`;
    case "marketer_pay": return `$${sum((j) => Number(j.total_marketer || 0)).toFixed(0)}`;
    case "parts": return `$${sum((j) => Number(j.parts || 0) + Number(j.office_parts || 0)).toFixed(0)}`;
    case "tip": return `$${sum((j) => Number(j.tip || 0)).toFixed(0)}`;
    case "paid_count": return String(jobs.filter((j) => j.paid).length);
  }
}

interface Props {
  greeting: string;
  jobs: Job[];
  filters: DataBoardFilters;
  range: DateRange | null;
  boardElementId: string; // dom id of the WidgetGrid container
}

function fmtCell(val: unknown, key: ColumnKey): string {
  if (val == null || val === "") return "—";
  if (key === "paid") return val ? "Yes" : "No";
  if (key === "job_date") return new Date(val as string).toLocaleDateString();
  if (key === "manual_percentage") return `${val}%`;
  if (typeof val === "number") return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return String(val);
}

function jobsToCsv(jobs: Job[], cols: ColumnKey[]): string {
  const headers = cols.map((k) => EXPORTABLE_COLUMNS.find((c) => c.key === k)?.label || k);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  for (const j of jobs) {
    lines.push(cols.map((k) => escape(fmtCell((j as any)[k], k))).join(","));
  }
  return lines.join("\n");
}

function activeFiltersText(f: DataBoardFilters): string {
  const parts: string[] = [];
  if (f.techs.length) parts.push(`Techs: ${f.techs.join(", ")}`);
  if (f.marketers.length) parts.push(`Marketers: ${f.marketers.join(", ")}`);
  if (f.installers.length) parts.push(`Installers: ${f.installers.join(", ")}`);
  if (f.jobTypes.length) parts.push(`Job types: ${f.jobTypes.join(", ")}`);
  if (f.statuses.length) parts.push(`Statuses: ${f.statuses.join(", ")}`);
  if (f.payments.length) parts.push(`Payments: ${f.payments.join(", ")}`);
  if (f.paid !== "any") parts.push(`Paid: ${f.paid}`);
  if (f.minPrice) parts.push(`Min $${f.minPrice}`);
  if (f.maxPrice) parts.push(`Max $${f.maxPrice}`);
  if (f.city) parts.push(`City: ${f.city}`);
  return parts.length ? parts.join(" • ") : "No filters applied";
}

export function ExportBoardDialog({ greeting, jobs, filters, range, boardElementId }: Props) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [name, setName] = useState("");
  const [sections, setSections] = useState(DEFAULT_EXPORT_SECTIONS);
  const [columns, setColumns] = useState<ColumnKey[]>(EXPORTABLE_COLUMNS.map((c) => c.key));
  const [kpiCols, setKpiCols] = useState<KpiKey[]>(DEFAULT_KPIS);
  const [attachJobs, setAttachJobs] = useState(true);
  const [pageSize, setPageSize] = useState<"a4" | "letter">("letter");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const p = loadDataBoardPrefs();
    setTemplates(p.exportTemplates);
  }, [open]);

  function applyTemplate(id: string) {
    setActiveId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSections(t.sections);
    setColumns(t.columns as ColumnKey[]);
    setKpiCols((t.kpiColumns as KpiKey[]) || DEFAULT_KPIS);
    setAttachJobs(t.attachJobs);
    setPageSize(t.pageSize);
    setOrientation(t.orientation);
  }

  function persist(next: ExportTemplate[]) {
    setTemplates(next);
    saveExportTemplates(next);
  }

  function saveAsTemplate() {
    if (!name.trim()) return;
    const t: ExportTemplate = {
      id: makeId(), name: name.trim(),
      sections, columns: columns as string[], kpiColumns: kpiCols as string[],
      attachJobs, pageSize, orientation,
    };
    persist([...templates, t]);
    setActiveId(t.id);
    setName("");
  }

  function deleteTemplate() {
    if (!activeId) return;
    persist(templates.filter((t) => t.id !== activeId));
    setActiveId("");
  }

  function toggleSection(id: ExportSectionId) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }
  function toggleCol(k: ColumnKey) {
    setColumns((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }
  function toggleKpi(k: KpiKey) {
    setKpiCols((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function runExport() {
    setBusy(true);
    const root = document.getElementById(boardElementId);
    // Map enabled widget-snapshot sections to widget types
    const wantedTypes = new Set<string>();
    for (const s of sections) {
      if (!s.enabled) continue;
      if (s.id === "charts") ["kpi", "chart", "insight", "goal", "table", "activity"].forEach((t) => wantedTypes.add(t));
      else if (s.id === "calendar") wantedTypes.add("calendar");
      else if (s.id === "map") wantedTypes.add("map");
    }
    const willSnapshot = root && wantedTypes.size > 0;
    if (willSnapshot) root.classList.add("pdf-capturing");
    // brief paint tick so layout settles before capture
    if (willSnapshot) await new Promise((r) => requestAnimationFrame(() => r(null)));

    try {
      const doc = new jsPDF({ orientation, unit: "pt", format: pageSize });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const MARGIN = 40;
      let y = MARGIN;

      const snapshotsDone = new Set<Element>(); // dedupe: never capture the same widget twice

      for (const s of sections) {
        if (!s.enabled) continue;

        if (s.id === "greeting") {
          doc.setFontSize(18); doc.text(greeting, MARGIN, y); y += 22;
          if (range) { doc.setFontSize(10); doc.setTextColor(120); doc.text(`Range: ${range.from} → ${range.to}`, MARGIN, y); doc.setTextColor(0); y += 16; }
        } else if (s.id === "filters") {
          doc.setFontSize(11); doc.text("Filters", MARGIN, y); y += 14;
          doc.setFontSize(9);
          const txt = doc.splitTextToSize(activeFiltersText(filters), W - MARGIN * 2);
          doc.text(txt, MARGIN, y); y += txt.length * 11 + 8;
        } else if (s.id === "kpis") {
          if (!kpiCols.length) continue;
          doc.setFontSize(11); doc.text("Snapshot", MARGIN, y); y += 14;
          const labels = kpiCols.map((k) => ALL_KPIS.find((x) => x.key === k)!.label);
          const values = kpiCols.map((k) => kpiCell(k, jobs));
          autoTable(doc, {
            startY: y,
            head: [labels],
            body: [values],
            theme: "grid", styles: { fontSize: 10 },
          });
          y = (doc as any).lastAutoTable.finalY + 12;
        } else if (s.id === "charts" || s.id === "calendar" || s.id === "map") {
          // Per-widget snapshot. Each widget is captured at most once across all three
          // sections (charts/calendar/map) to prevent duplicated images on multiple pages.
          if (!root) continue;
          const sectionTypes = s.id === "charts"
            ? ["kpi", "chart", "insight", "goal", "table", "activity"]
            : s.id === "calendar" ? ["calendar"] : ["map"];
          const els = Array.from(
            root.querySelectorAll<HTMLElement>("[data-pdf-section]")
          ).filter((el) => sectionTypes.includes(el.dataset.widgetType || "") && !snapshotsDone.has(el));

          for (const el of els) {
            try {
              const png = await htmlToImage.toPng(el, { cacheBust: true, pixelRatio: 1.5, backgroundColor: "#ffffff" });
              const img = new Image();
              await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = png; });
              const ratio = img.width / img.height;
              const maxW = W - MARGIN * 2;
              const maxH = H - MARGIN * 2;
              let w = maxW;
              let h = w / ratio;
              if (h > maxH) { h = maxH; w = h * ratio; }
              // Smart page break: if the widget won't fit on the rest of the current page, start a new one.
              if (y + h > H - MARGIN) {
                doc.addPage();
                y = MARGIN;
              }
              doc.addImage(png, "PNG", MARGIN, y, w, h);
              y += h + 10;
              snapshotsDone.add(el);
            } catch (e) {
              console.warn("widget snapshot failed", e);
            }
          }
        } else if (s.id === "table") {
          if (y > H - 100) { doc.addPage(); y = MARGIN; }
          autoTable(doc, {
            startY: y,
            head: [columns.map((k) => EXPORTABLE_COLUMNS.find((c) => c.key === k)?.label || k)],
            body: jobs.map((j) => columns.map((k) => fmtCell((j as any)[k], k))),
            styles: { fontSize: 7 }, headStyles: { fillColor: [59, 130, 246] },
          });
          y = (doc as any).lastAutoTable.finalY + 12;
        } else if (s.id === "appendix") {
          doc.addPage(); y = MARGIN;
          doc.setFontSize(13); doc.text("Appendix — Full job data", MARGIN, y); y += 18;
          autoTable(doc, {
            startY: y,
            head: [columns.map((k) => EXPORTABLE_COLUMNS.find((c) => c.key === k)?.label || k)],
            body: jobs.map((j) => columns.map((k) => fmtCell((j as any)[k], k))),
            styles: { fontSize: 6 }, headStyles: { fillColor: [16, 185, 129] },
          });
        }
      }

      const fileName = `databoard-${new Date().toISOString().slice(0, 10)}`;

      if (attachJobs) {
        const zip = new JSZip();
        zip.file(`${fileName}.pdf`, doc.output("blob"));
        zip.file(`${fileName}-jobs.csv`, jobsToCsv(jobs, columns));
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${fileName}.zip`; a.click();
        URL.revokeObjectURL(url);
      } else {
        doc.save(`${fileName}.pdf`);
      }
      setOpen(false);
    } finally {
      if (willSnapshot && root) root.classList.remove("pdf-capturing");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><FileDown className="h-4 w-4 mr-1" /> Export</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export DataBoard report</DialogTitle>
          <DialogDescription className="sr-only">Configure sections, KPIs, columns and templates for your PDF report.</DialogDescription>
        </DialogHeader>

        {/* Templates */}
        <div className="space-y-2 pb-3 border-b">
          <span className="text-xs font-medium text-muted-foreground">Export template</span>
          <div className="flex gap-2">
            <Select value={activeId || "none"} onValueChange={(v) => applyTemplate(v === "none" ? "" : v)}>
              <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Load…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {activeId && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={deleteTemplate}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Save as template…" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={saveAsTemplate} disabled={!name.trim()}>
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sections */}
        <div>
          <div className="text-sm font-medium mb-2">Sections</div>
          <div className="grid grid-cols-2 gap-1.5">
            {sections.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={s.enabled} onCheckedChange={() => toggleSection(s.id)} />
                {SECTION_LABELS[s.id]}
              </label>
            ))}
          </div>
        </div>

        {/* KPI columns */}
        <div>
          <div className="text-sm font-medium mb-2">KPI snapshot columns ({kpiCols.length}/{ALL_KPIS.length})</div>
          <div className="grid grid-cols-3 gap-1.5 border rounded p-2">
            {ALL_KPIS.map((k) => (
              <label key={k.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={kpiCols.includes(k.key)} onCheckedChange={() => toggleKpi(k.key)} />
                <span className="truncate">{k.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Columns */}
        <div>
          <div className="text-sm font-medium mb-2">Table columns ({columns.length}/{EXPORTABLE_COLUMNS.length})</div>
          <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto border rounded p-2">
            {EXPORTABLE_COLUMNS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={columns.includes(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                <span className="truncate">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-3 gap-2">
          <Select value={pageSize} onValueChange={(v) => setPageSize(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="letter">Letter</SelectItem>
              <SelectItem value="a4">A4</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orientation} onValueChange={(v) => setOrientation(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="landscape">Landscape</SelectItem>
              <SelectItem value="portrait">Portrait</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={attachJobs} onCheckedChange={(v) => setAttachJobs(!!v)} />
            Attach jobs CSV
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={runExport} disabled={busy}>{busy ? "Exporting…" : "Export"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
