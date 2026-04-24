import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const PRESET_KEY = "date_range_presets";

export type DateRange = { from: string; to: string }; // YYYY-MM-DD

export type DatePreset = {
  id: string;
  name: string;
  // dynamic = computed weekly from "today", static = absolute dates,
  // builtin-range = predefined non-weekly range (today / month / year)
  type: "dynamic" | "static" | "builtin-range";
  // dynamic config:
  startDay?: number; // 0=Sun..6=Sat
  endDay?: number;
  weekOffset?: number; // 0 = current week, -1 = last week
  // static config:
  from?: string;
  to?: string;
  // builtin-range key:
  rangeKey?: "today" | "this-month" | "this-year";
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(date: Date, weekStartsOn: number) {
  const d = new Date(date);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function resolvePreset(p: DatePreset, today = new Date()): DateRange | null {
  if (p.type === "static") {
    if (!p.from || !p.to) return null;
    return { from: p.from, to: p.to };
  }
  const startDay = p.startDay ?? 1;
  const endDay = p.endDay ?? 0;
  const offset = p.weekOffset ?? 0;
  const start = startOfWeek(today, startDay);
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start);
  const span = (endDay - startDay + 7) % 7;
  end.setDate(end.getDate() + span);
  return { from: fmt(start), to: fmt(end) };
}

const BUILT_IN: DatePreset[] = [
  { id: "builtin-mon-sun", name: "This week (Mon–Sun)", type: "dynamic", startDay: 1, endDay: 0, weekOffset: 0 },
  { id: "builtin-mon-fri", name: "This week (Mon–Fri)", type: "dynamic", startDay: 1, endDay: 5, weekOffset: 0 },
  { id: "builtin-last-mon-sun", name: "Last week (Mon–Sun)", type: "dynamic", startDay: 1, endDay: 0, weekOffset: -1 },
];

async function loadCustomPresets(): Promise<DatePreset[]> {
  const { data } = await (supabase as any)
    .from("app_settings").select("value").eq("key", PRESET_KEY).maybeSingle();
  return Array.isArray(data?.value?.presets) ? data.value.presets : [];
}
async function saveCustomPresets(presets: DatePreset[]) {
  await (supabase as any).from("app_settings").upsert({
    key: PRESET_KEY, value: { presets }, updated_at: new Date().toISOString(),
  });
}

interface Props {
  range: DateRange | null;
  onChange: (r: DateRange | null) => void;
}

export function DateRangePresets({ range, onChange }: Props) {
  const [custom, setCustom] = useState<DatePreset[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { loadCustomPresets().then(setCustom); }, []);

  const all = [...BUILT_IN, ...custom];

  function applyPreset(p: DatePreset) {
    const r = resolvePreset(p);
    if (r) onChange(r);
    setPickerOpen(false);
  }

  async function deletePreset(id: string) {
    const next = custom.filter((p) => p.id !== id);
    setCustom(next);
    await saveCustomPresets(next);
  }

  async function addPreset(p: DatePreset) {
    const next = [...custom, p];
    setCustom(next);
    await saveCustomPresets(next);
  }

  const label = range ? `${range.from} → ${range.to}` : "Date range";

  return (
    <div className="min-w-[220px]">
      <label className="text-xs font-medium text-muted-foreground mb-1 block">Date range</label>
      <div className="flex gap-1">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("flex-1 justify-start font-normal", !range && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              <span className="truncate">{label}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[280px] p-2">
            <div className="space-y-1 max-h-[260px] overflow-y-auto">
              {all.map((p) => {
                const r = resolvePreset(p);
                return (
                  <div key={p.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => applyPreset(p)}
                      className="flex-1 text-left px-2 py-1.5 rounded hover:bg-accent text-sm"
                    >
                      <div className="font-medium">{p.name}</div>
                      {r && <div className="text-xs text-muted-foreground">{r.from} → {r.to}</div>}
                    </button>
                    {!p.id.startsWith("builtin-") && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => deletePreset(p.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="border-t mt-2 pt-2">
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setCreatorOpen(true); setPickerOpen(false); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New preset
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {range && (
          <Button variant="ghost" size="icon" onClick={() => onChange(null)} title="Clear date range">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <PresetCreator open={creatorOpen} onOpenChange={setCreatorOpen} onSave={addPreset} />
    </div>
  );
}

function PresetCreator({
  open, onOpenChange, onSave,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (p: DatePreset) => void }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"dynamic" | "static">("dynamic");
  const [startDay, setStartDay] = useState(1);
  const [endDay, setEndDay] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function reset() {
    setName(""); setMode("dynamic"); setStartDay(1); setEndDay(0); setWeekOffset(0);
    setFrom(""); setTo("");
  }

  function handleSave() {
    if (!name.trim()) return;
    const p: DatePreset = mode === "dynamic"
      ? { id: Math.random().toString(36).slice(2, 10), name: name.trim(), type: "dynamic", startDay, endDay, weekOffset }
      : { id: Math.random().toString(36).slice(2, 10), name: name.trim(), type: "static", from, to };
    onSave(p);
    reset();
    onOpenChange(false);
  }

  const preview = mode === "dynamic"
    ? resolvePreset({ id: "x", name: "x", type: "dynamic", startDay, endDay, weekOffset })
    : (from && to ? { from, to } : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New date range preset</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pay period" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Type</label>
            <Select value={mode} onValueChange={(v) => setMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dynamic">Recurring (weekly)</SelectItem>
                <SelectItem value="static">Fixed dates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "dynamic" ? (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Start day</label>
                <Select value={String(startDay)} onValueChange={(v) => setStartDay(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">End day</label>
                <Select value={String(endDay)} onValueChange={(v) => setEndDay(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Week</label>
                <Select value={String(weekOffset)} onValueChange={(v) => setWeekOffset(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">This week</SelectItem>
                    <SelectItem value="-1">Last week</SelectItem>
                    <SelectItem value="1">Next week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">From</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">To</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}

          {preview && (
            <div className="text-xs text-muted-foreground">
              Preview: <span className="font-mono">{preview.from} → {preview.to}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || (mode === "static" && (!from || !to))}>Save preset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
