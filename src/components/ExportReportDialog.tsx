import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { FileDown, GripVertical } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ALL_COLUMNS, type ColumnKey } from "@/components/ColumnToggle";
import type { Tables } from "@/integrations/supabase/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Job = Tables<"jobs">;

const EXPORTABLE_COLUMNS = ALL_COLUMNS.filter(c => c.key !== "actions") as { key: ColumnKey; label: string }[];

type SectionId = "title" | "range" | "totals" | "table";
const DEFAULT_SECTIONS: { id: SectionId; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "range", label: "Date Range" },
  { id: "totals", label: "Totals Row" },
  { id: "table", label: "Jobs Table" },
];

function fmt(val: unknown, key: ColumnKey): string {
  if (val == null || val === "") return "—";
  if (key === "paid") return val ? "Yes" : "No";
  if (key === "job_date") return new Date(val as string).toLocaleDateString();
  if (key === "manual_percentage") return `${val}%`;
  if (typeof val === "number") return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return String(val);
}

function getCellValue(job: Job, key: ColumnKey): unknown {
  if (key === "company") return job.company_1 || job.company;
  return (job as any)[key];
}

function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SortableSectionRow({ id, label, enabled, onToggle }: { id: SectionId; label: string; enabled: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-background">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" type="button" aria-label="Drag">
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox checked={enabled} onCheckedChange={onToggle} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

interface ExportReportDialogProps {
  jobs: Job[];
  companies: string[];
}

export function ExportReportDialog({ jobs, companies }: ExportReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<Set<ColumnKey>>(
    new Set(["job_date", "company", "tech_name", "job_type", "status", "price", "total_tech", "paid"])
  );
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set(companies));
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [enabledSections, setEnabledSections] = useState<Set<SectionId>>(
    new Set(["title", "range", "totals", "table"])
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useMemo(() => {
    setSelectedCompanies(prev => prev.size === 0 ? new Set(companies) : prev);
  }, [companies.length]);

  function toggleColumn(key: ColumnKey) {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleCompany(name: string) {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleSection(id: SectionId) {
    setEnabledSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function onSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections(items => {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function generatePdf() {
    const filtered = jobs.filter(j => {
      if (dateFrom && (!j.job_date || j.job_date < dateFrom)) return false;
      if (dateTo && (!j.job_date || j.job_date > dateTo)) return false;
      const co = j.company_1 || j.company || "";
      if (selectedCompanies.size > 0 && !selectedCompanies.has(co)) return false;
      return true;
    });

    const cols = EXPORTABLE_COLUMNS.filter(c => selectedColumns.has(c.key));
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();

    // Compute totals
    const totals = filtered.reduce((acc, j) => {
      acc.price += Number(j.price || 0);
      acc.tech += Number(j.total_tech || 0);
      acc.office += Number(j.total_office || 0);
      acc.marketer += Number(j.total_marketer || 0);
      return acc;
    }, { price: 0, tech: 0, office: 0, marketer: 0 });

    const rangeText = dateFrom || dateTo
      ? `Time range: ${dateFrom || "Beginning"}  →  ${dateTo || "Today"}`
      : "Time range: All dates";

    let y = 14;

    for (const section of sections) {
      if (!enabledSections.has(section.id)) continue;

      if (section.id === "title") {
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Jobs Report", 14, y);
        y += 7;
      }

      if (section.id === "range") {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(rangeText, 14, y);
        y += 5;
        doc.setFontSize(9);
        doc.text(`Total jobs: ${filtered.length}`, 14, y);
        y += 6;
      }

      if (section.id === "totals") {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(
          `Revenue: ${money(totals.price)}    Tech: ${money(totals.tech)}    Office: ${money(totals.office)}    Marketer: ${money(totals.marketer)}`,
          14, y
        );
        doc.setFont("helvetica", "normal");
        y += 6;
      }

      if (section.id === "table") {
        autoTable(doc, {
          startY: y,
          head: [cols.map(c => c.label)],
          body: filtered.map(j => cols.map(c => fmt(getCellValue(j, c.key), c.key))),
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [60, 60, 60] },
          margin: { left: 8, right: 8 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // page break safety
      if (y > doc.internal.pageSize.getHeight() - 20 && section.id !== "table") {
        doc.addPage();
        y = 14;
      }
    }

    void pageW;
    doc.save(`jobs-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <FileDown className="h-4 w-4 mr-2" /> Export PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Jobs Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">From date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">PDF sections (drag to reorder, check to include)</Label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
              <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {sections.map(s => (
                    <SortableSectionRow
                      key={s.id}
                      id={s.id}
                      label={s.label}
                      enabled={enabledSections.has(s.id)}
                      onToggle={() => toggleSection(s.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Fields to include ({selectedColumns.size})</Label>
              <div className="flex gap-2 text-xs">
                <button className="text-primary hover:underline" onClick={() => setSelectedColumns(new Set(EXPORTABLE_COLUMNS.map(c => c.key)))}>All</button>
                <button className="text-primary hover:underline" onClick={() => setSelectedColumns(new Set())}>None</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border rounded-md p-3 max-h-48 overflow-y-auto">
              {EXPORTABLE_COLUMNS.map(c => (
                <label key={c.key} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={selectedColumns.has(c.key)} onCheckedChange={() => toggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Marketers ({selectedCompanies.size}/{companies.length})</Label>
              <div className="flex gap-2 text-xs">
                <button className="text-primary hover:underline" onClick={() => setSelectedCompanies(new Set(companies))}>All</button>
                <button className="text-primary hover:underline" onClick={() => setSelectedCompanies(new Set())}>None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-40 overflow-y-auto">
              {companies.length === 0 && <span className="text-sm text-muted-foreground col-span-2">No marketers found.</span>}
              {companies.map(name => (
                <label key={name} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={selectedCompanies.has(name)} onCheckedChange={() => toggleCompany(name)} />
                  <span className="truncate">{name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={generatePdf} disabled={selectedColumns.size === 0 || enabledSections.size === 0}>
            <FileDown className="h-4 w-4 mr-2" /> Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
