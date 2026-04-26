import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InsightSettings, InsightDimension, InsightMetric, InsightViz } from "./widgets/InsightWidget";

const DIMENSIONS: { v: InsightDimension; l: string }[] = [
  { v: "tech_name", l: "Technician" },
  { v: "company", l: "Marketer / Company" },
  { v: "job_type", l: "Job type" },
  { v: "status", l: "Status" },
  { v: "payment", l: "Payment method" },
  { v: "installer_name", l: "Installer" },
  { v: "city", l: "City" },
  { v: "day", l: "Day" },
  { v: "week", l: "Week" },
  { v: "month", l: "Month" },
];

const METRICS: { v: InsightMetric; l: string }[] = [
  { v: "revenue", l: "Revenue" },
  { v: "profit", l: "Profit" },
  { v: "count", l: "Job count" },
  { v: "avg_ticket", l: "Avg ticket" },
  { v: "tech_pay", l: "Tech pay" },
  { v: "marketer_pay", l: "Marketer pay" },
  { v: "parts_cost", l: "Parts cost" },
  { v: "tip", l: "Tip" },
];

const VIZS: { v: InsightViz; l: string }[] = [
  { v: "bar", l: "Bar chart" },
  { v: "line", l: "Line chart" },
  { v: "area", l: "Area chart" },
  { v: "pie", l: "Pie chart" },
  { v: "donut", l: "Donut chart" },
  { v: "table", l: "Table" },
  { v: "number", l: "Big number" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  settings: InsightSettings;
  onSave: (title: string, settings: InsightSettings) => void;
}

export function InsightSettingsDialog({ open, onOpenChange, title, settings, onSave }: Props) {
  const [t, setT] = useState(title);
  const [s, setS] = useState<InsightSettings>(settings);

  useEffect(() => { if (open) { setT(title); setS(settings); } }, [open, title, settings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Configure widget</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={t} onChange={(e) => setT(e.target.value)} className="h-9" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Group by</Label>
              <Select value={s.dimension} onValueChange={(v) => setS({ ...s, dimension: v as InsightDimension })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{DIMENSIONS.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Metric</Label>
              <Select value={s.metric} onValueChange={(v) => setS({ ...s, metric: v as InsightMetric })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{METRICS.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Visualization</Label>
              <Select value={s.viz} onValueChange={(v) => setS({ ...s, viz: v as InsightViz })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{VIZS.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sort</Label>
              <Select value={s.sort || "desc"} onValueChange={(v) => setS({ ...s, sort: v as any })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Highest first</SelectItem>
                  <SelectItem value="asc">Lowest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Top N (categorical only)</Label>
            <Input
              type="number" min={1} max={50}
              value={s.limit ?? 10}
              onChange={(e) => setS({ ...s, limit: Math.max(1, Number(e.target.value) || 10) })}
              className="h-9"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-2">
            <div>
              <Label className="text-xs">Only count completed jobs</Label>
              <div className="text-[11px] text-muted-foreground">Excludes Cancelled / Pending jobs from this widget.</div>
            </div>
            <Switch checked={!!s.completedOnly} onCheckedChange={(v) => setS({ ...s, completedOnly: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave(t.trim() || "Insight", s); onOpenChange(false); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
