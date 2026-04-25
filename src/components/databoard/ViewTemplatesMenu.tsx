import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Layers, Save, Trash2, Check } from "lucide-react";
import {
  loadDataBoardPrefs, saveViewTemplates, saveActiveViewId, makeId,
  type ViewTemplate, type DataBoardFilters,
} from "@/lib/databoard/templates";
import type { WidgetConfig } from "./WidgetGrid";
import type { RangeKey } from "./TimeRangeBar";
import type { DateRange } from "@/components/DateRangePresets";

interface Props {
  current: {
    widgets: WidgetConfig[];
    layouts: Record<string, any[]>;
    filters: DataBoardFilters;
    rangeKey: RangeKey;
    customRange: DateRange | null;
  };
  onApply: (t: ViewTemplate) => void;
  activeId: string;
  onActiveChange: (id: string) => void;
}

export function ViewTemplatesMenu({ current, onApply, activeId, onActiveChange }: Props) {
  const [templates, setTemplates] = useState<ViewTemplate[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setTemplates(loadDataBoardPrefs().viewTemplates);
  }, []);

  function persist(next: ViewTemplate[]) {
    setTemplates(next);
    saveViewTemplates(next);
  }

  function doSave() {
    if (!name.trim()) return;
    const t: ViewTemplate = {
      id: makeId(),
      name: name.trim(),
      widgets: current.widgets,
      layouts: current.layouts,
      filters: current.filters,
      rangeKey: current.rangeKey,
      customRange: current.customRange,
    };
    persist([...templates, t]);
    onActiveChange(t.id);
    saveActiveViewId(t.id);
    setSaveOpen(false);
    setName("");
  }

  function apply(t: ViewTemplate) {
    onApply(t);
    onActiveChange(t.id);
    saveActiveViewId(t.id);
  }

  function del(id: string) {
    persist(templates.filter((t) => t.id !== id));
    if (activeId === id) { onActiveChange(""); saveActiveViewId(null); }
  }

  function overwriteActive() {
    if (!activeId) return;
    const next = templates.map((t) =>
      t.id === activeId ? { ...t, widgets: current.widgets, layouts: current.layouts, filters: current.filters, rangeKey: current.rangeKey, customRange: current.customRange } : t
    );
    persist(next);
  }

  const active = templates.find((t) => t.id === activeId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Layers className="h-4 w-4 mr-1" />
            {active ? active.name : "Views"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>View templates</DropdownMenuLabel>
          {templates.length === 0 && (
            <div className="px-2 py-1 text-xs text-muted-foreground">No templates yet.</div>
          )}
          {templates.map((t) => (
            <div key={t.id} className="flex items-center">
              <DropdownMenuItem className="flex-1" onClick={() => apply(t)}>
                {activeId === t.id && <Check className="h-3.5 w-3.5 mr-1" />}
                <span className="truncate">{t.name}</span>
              </DropdownMenuItem>
              <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" onClick={(e) => { e.stopPropagation(); del(t.id); }}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <DropdownMenuSeparator />
          {activeId && (
            <DropdownMenuItem onClick={overwriteActive}>
              <Save className="h-4 w-4 mr-2" /> Update current template
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setSaveOpen(true)}>
            <Save className="h-4 w-4 mr-2" /> Save as new…
          </DropdownMenuItem>
          {activeId && (
            <DropdownMenuItem onClick={() => { onActiveChange(""); saveActiveViewId(null); }}>
              Clear active
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Save view template</DialogTitle></DialogHeader>
          <Input placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button onClick={doSave} disabled={!name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
