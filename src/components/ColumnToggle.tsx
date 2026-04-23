import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Columns3, Save, Trash2 } from "lucide-react";
import { loadTemplates, saveTemplates, makeId, type DashboardViewTemplate, type TemplatesSetting } from "@/lib/settings";

export const ALL_COLUMNS = [
  { key: "actions", label: "Actions" },
  { key: "job_date", label: "Date" },
  { key: "company", label: "Marketer" },
  { key: "tech_name", label: "Tech" },
  { key: "po_number", label: "PO #" },
  { key: "job_type", label: "Job Type" },
  { key: "status", label: "Status" },
  { key: "price", label: "Price" },
  { key: "co_parts", label: "Co Parts" },
  { key: "office_parts", label: "Office Parts" },
  { key: "parts", label: "Parts" },
  { key: "manual_percentage", label: "Tech %" },
  { key: "total_marketer", label: "Total Marketer" },
  { key: "total_office", label: "Total Office" },
  { key: "total_tech", label: "Total Tech" },
  { key: "tip", label: "Tip" },
  { key: "cc_fee", label: "CC Fee" },
  { key: "payment", label: "Payment" },
  { key: "paid", label: "Paid" },
] as const;

export type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

const DEFAULT_VISIBLE = new Set<ColumnKey>(ALL_COLUMNS.map(c => c.key));

export function useColumnVisibility() {
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(DEFAULT_VISIBLE);

  function toggle(key: ColumnKey) {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function showAll() {
    setVisibleColumns(new Set(ALL_COLUMNS.map(c => c.key)));
  }

  function setVisible(keys: ColumnKey[]) {
    setVisibleColumns(new Set(keys));
  }

  return { visibleColumns, toggle, showAll, setVisible };
}

interface ColumnToggleProps {
  visibleColumns: Set<ColumnKey>;
  onToggle: (key: ColumnKey) => void;
  onShowAll: () => void;
  onSetVisible: (keys: ColumnKey[]) => void;
}

const ACTIVE_VIEW_KEY = "dashboard_active_view_id";

export function ColumnToggle({ visibleColumns, onToggle, onShowAll, onSetVisible }: ColumnToggleProps) {
  const [templates, setTemplates] = useState<TemplatesSetting>({ dashboardViews: [], exportTemplates: [] });
  const [activeId, setActiveId] = useState<string>("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadTemplates().then((t) => {
      setTemplates(t);
      const savedId = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_VIEW_KEY) || "" : "";
      const match = savedId ? t.dashboardViews.find(v => v.id === savedId) : null;
      if (match) {
        setActiveId(match.id);
        onSetVisible(match.visibleColumns as ColumnKey[]);
      } else if (savedId) {
        // template no longer exists — clear stale id
        localStorage.removeItem(ACTIVE_VIEW_KEY);
      }
    });
  }, []);

  function applyTemplate(id: string) {
    setActiveId(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(ACTIVE_VIEW_KEY, id);
      else localStorage.removeItem(ACTIVE_VIEW_KEY);
    }
    if (!id) return;
    const t = templates.dashboardViews.find(v => v.id === id);
    if (t) onSetVisible(t.visibleColumns as ColumnKey[]);
  }

  async function saveAs() {
    const name = newName.trim();
    if (!name) return;
    const tpl: DashboardViewTemplate = {
      id: makeId(),
      name,
      visibleColumns: Array.from(visibleColumns),
    };
    const next = { ...templates, dashboardViews: [...templates.dashboardViews, tpl] };
    setTemplates(next);
    await saveTemplates(next);
    setActiveId(tpl.id);
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_VIEW_KEY, tpl.id);
    setNewName("");
  }

  async function deleteActive() {
    if (!activeId) return;
    const next = { ...templates, dashboardViews: templates.dashboardViews.filter(v => v.id !== activeId) };
    setTemplates(next);
    await saveTemplates(next);
    setActiveId("");
    if (typeof window !== "undefined") localStorage.removeItem(ACTIVE_VIEW_KEY);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Columns3 className="h-4 w-4 mr-2" />
          Columns ({visibleColumns.size}/{ALL_COLUMNS.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-2 mb-3 pb-3 border-b">
          <span className="text-xs font-medium text-muted-foreground">View template</span>
          <div className="flex gap-1">
            <Select value={activeId || "none"} onValueChange={(v) => applyTemplate(v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder="Load…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {templates.dashboardViews.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeId && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={deleteActive} title="Delete template">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
          <div className="flex gap-1">
            <Input placeholder="Save view as…" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" />
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={saveAs} disabled={!newName.trim()} title="Save template">
              <Save className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Toggle Columns</span>
          <button onClick={onShowAll} className="text-xs text-primary hover:underline">Show all</button>
        </div>
        <div className="space-y-2 max-h-[280px] overflow-y-auto">
          {ALL_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={visibleColumns.has(col.key)} onCheckedChange={() => onToggle(col.key)} />
              <span className="text-sm">{col.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
