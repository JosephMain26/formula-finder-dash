import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/DatePickerField";
import { Calendar, Radio, Plus, Trash2 } from "lucide-react";
import type { DateRange } from "@/components/DateRangePresets";

type RangeKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function resolveRange(key: RangeKey, custom?: DateRange | null): DateRange | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (key) {
    case "today":
      return { from: fmt(today), to: fmt(today) };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "this_week": {
      const s = startOfWeek(today);
      return { from: fmt(s), to: fmt(today) };
    }
    case "last_week": {
      const s = startOfWeek(today); s.setDate(s.getDate() - 7);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      return { from: fmt(s), to: fmt(e) };
    }
    case "this_month": {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(s), to: fmt(today) };
    }
    case "last_month": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(s), to: fmt(e) };
    }
    case "this_year": {
      const s = new Date(today.getFullYear(), 0, 1);
      return { from: fmt(s), to: fmt(today) };
    }
    case "custom":
      return custom || null;
  }
}

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Live (Today)" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This week" },
  { key: "last_week", label: "Last week" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_year", label: "This year" },
];

export interface SavedRange {
  id: string;
  name: string;
  from: string;
  to: string;
}

interface Props {
  rangeKey: RangeKey;
  customRange: DateRange | null;
  savedRanges: SavedRange[];
  onChange: (key: RangeKey, custom: DateRange | null) => void;
  onSaveRange: (r: SavedRange) => void;
  onDeleteSaved: (id: string) => void;
}

export function TimeRangeBar({
  rangeKey,
  customRange,
  savedRanges,
  onChange,
  onSaveRange,
  onDeleteSaved,
}: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(customRange?.from || "");
  const [to, setTo] = useState(customRange?.to || "");
  const [savedOpen, setSavedOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setFrom(customRange?.from || "");
    setTo(customRange?.to || "");
  }, [customRange]);

  const resolved = useMemo(() => resolveRange(rangeKey, customRange), [rangeKey, customRange]);
  const isLive = rangeKey === "today";

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg bg-card sticky top-0 z-10">
      {isLive && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
          <Radio className="h-3 w-3 animate-pulse" /> LIVE
        </span>
      )}
      {PRESETS.map((p) => (
        <Button
          key={p.key}
          size="sm"
          variant={rangeKey === p.key ? "default" : "outline"}
          onClick={() => onChange(p.key, null)}
        >
          {p.label}
        </Button>
      ))}

      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant={rangeKey === "custom" ? "default" : "outline"}>
            <Calendar className="h-3.5 w-3.5 mr-1" /> Custom
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-2">
          <div>
            <label className="text-xs font-medium mb-1 block">From</label>
            <DatePickerField value={from} onChange={setFrom} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">To</label>
            <DatePickerField value={to} onChange={setTo} />
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!from || !to}
            onClick={() => {
              onChange("custom", { from, to });
              setCustomOpen(false);
            }}
          >
            Apply
          </Button>
        </PopoverContent>
      </Popover>

      <Popover open={savedOpen} onOpenChange={setSavedOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">Saved ({savedRanges.length})</Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-2">
          {savedRanges.length === 0 && (
            <div className="text-xs text-muted-foreground">No saved ranges yet.</div>
          )}
          {savedRanges.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
              <button
                className="flex-1 text-left px-2 py-1 rounded hover:bg-accent text-sm"
                onClick={() => {
                  onChange("custom", { from: s.from, to: s.to });
                  setSavedOpen(false);
                }}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.from} → {s.to}</div>
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteSaved(s.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="border-t pt-2 space-y-2">
            <Input placeholder="Name this range" value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              size="sm"
              className="w-full"
              disabled={!name.trim() || !resolved}
              onClick={() => {
                if (!resolved) return;
                onSaveRange({ id: Math.random().toString(36).slice(2, 10), name: name.trim(), from: resolved.from, to: resolved.to });
                setName("");
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Save current range
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {resolved && (
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {resolved.from} → {resolved.to}
        </span>
      )}
    </div>
  );
}

export type { RangeKey };
