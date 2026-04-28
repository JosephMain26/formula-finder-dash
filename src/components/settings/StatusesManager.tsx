import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowUp, ArrowDown, Star } from "lucide-react";
import {
  loadStatuses, saveStatuses, newStatus,
  STATUS_COLORS, type StatusDef, type StatusColor,
} from "@/lib/jobSchema";
import { refreshStatusesCache } from "@/components/StatusBadge";
import { toast } from "sonner";

const COLOR_KEYS = Object.keys(STATUS_COLORS) as StatusColor[];

export function StatusesManager() {
  const [statuses, setStatuses] = useState<StatusDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadStatuses().then((s) => { setStatuses(s); setLoading(false); }); }, []);

  function update(id: string, patch: Partial<StatusDef>) {
    setStatuses((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function add() { setStatuses((prev) => [...prev, newStatus({ order: prev.length })]); }
  function remove(id: string) { setStatuses((prev) => prev.filter((s) => s.id !== id)); }
  function move(id: string, dir: -1 | 1) {
    setStatuses((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  }
  function setDefault(id: string) {
    setStatuses((prev) => prev.map((s) => ({ ...s, isDefault: s.id === id })));
  }

  async function save() {
    setSaving(true);
    const cleaned = statuses
      .map((s, i) => ({ ...s, name: s.name.trim() || "Untitled", order: i }))
      .filter((s) => s.name.length > 0);
    setStatuses(cleaned);
    await saveStatuses(cleaned);
    await refreshStatusesCache();
    setSaving(false);
    toast.success("Statuses saved");
  }

  return (
    <Card>
      <CardHeader><CardTitle>Statuses & Tags</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Manage the status options used in the Add/Edit Job form, the jobs list, and the filters. Pick a color and mark one as the default for new jobs.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2">
            {statuses.map((s, i) => (
              <div key={s.id} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2">
                <Input
                  className="col-span-12 sm:col-span-4 h-9"
                  value={s.name}
                  onChange={(e) => update(s.id, { name: e.target.value })}
                  placeholder="Status name"
                />
                <div className="col-span-6 sm:col-span-3">
                  <Select value={s.color} onValueChange={(v) => update(s.id, { color: v as StatusColor })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLOR_KEYS.map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="inline-flex items-center gap-2">
                            <span className={`inline-block h-3 w-3 rounded-full ${STATUS_COLORS[c].split(" ")[0]}`} />
                            {c}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Badge className={STATUS_COLORS[s.color]}>{s.name || "Preview"}</Badge>
                </div>
                <div className="col-span-3 sm:col-span-3 flex items-center gap-1 justify-end">
                  <Button
                    type="button" size="icon" variant={s.isDefault ? "default" : "ghost"}
                    className="h-8 w-8" onClick={() => setDefault(s.id)} title="Mark as default"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(s.id, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(s.id, 1)} disabled={i === statuses.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="h-4 w-4 mr-2" /> Add status
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Statuses"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
