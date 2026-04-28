import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowUp, ArrowDown, Lock } from "lucide-react";
import {
  loadFormSchema, saveFormSchema, newCustomField,
  type CustomField, type CustomFieldType,
} from "@/lib/jobSchema";
import {
  CORE_FIELDS_DEFAULT, defaultOverrides,
  type CoreFieldOverride, type CoreFieldKey,
} from "@/lib/coreFields";
import { toast } from "sonner";

const TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Yes / No" },
];

export function JobFormBuilder() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [core, setCore] = useState<CoreFieldOverride[]>(defaultOverrides());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFormSchema().then((s) => {
      setFields(s.fields);
      setCore(reorderSequential(s.core));
      setLoading(false);
    });
  }, []);

  // ---------- Custom fields handlers ----------
  function update(id: string, patch: Partial<CustomField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function add() { setFields((prev) => [...prev, newCustomField()]); }
  function remove(id: string) { setFields((prev) => prev.filter((f) => f.id !== id)); }
  function move(id: string, dir: -1 | 1) {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  // ---------- Core fields handlers ----------
  function reorderSequential(list: CoreFieldOverride[]): CoreFieldOverride[] {
    return list.slice().sort((a, b) => a.order - b.order).map((o, i) => ({ ...o, order: i }));
  }
  function patchCore(key: CoreFieldKey, patch: Partial<CoreFieldOverride>) {
    setCore((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  }
  function moveCore(key: CoreFieldKey, dir: -1 | 1) {
    setCore((prev) => {
      const sorted = prev.slice().sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((o) => o.key === key);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= sorted.length) return prev;
      [sorted[idx], sorted[j]] = [sorted[j], sorted[idx]];
      return sorted.map((o, i) => ({ ...o, order: i }));
    });
  }
  function resetCore() {
    setCore(defaultOverrides());
    toast.message("Built-in fields reset (not saved yet)");
  }

  async function save() {
    setSaving(true);
    const cleaned = fields.map((f) => ({ ...f, label: f.label.trim() || "Untitled", key: f.key.trim() || `x_${f.id}` }));
    setFields(cleaned);
    await saveFormSchema({ fields: cleaned, core: reorderSequential(core) });
    setSaving(false);
    toast.success("Job form saved");
  }

  const sortedCore = core.slice().sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Form Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ============ Built-in fields ============ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Built-in fields</h3>
              <p className="text-xs text-muted-foreground">Rename, reorder, hide or require the standard job fields. Locked fields are required for the totals math and can't be hidden.</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={resetCore}>Reset to defaults</Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="rounded-md border divide-y">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <div className="col-span-4">Field / label</div>
                <div className="col-span-2 text-center">Form</div>
                <div className="col-span-2 text-center">Remote</div>
                <div className="col-span-2 text-center">Parse review</div>
                <div className="col-span-1 text-center">Required</div>
                <div className="col-span-1 text-right">Order</div>
              </div>
              {sortedCore.map((o, i) => {
                const def = CORE_FIELDS_DEFAULT.find((d) => d.key === o.key);
                if (!def) return null;
                const locked = !!def.locked;
                return (
                  <div key={o.key} className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-sm">
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      {locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <Input
                        value={o.label ?? def.label}
                        onChange={(e) => patchCore(o.key, { label: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Checkbox
                        checked={locked ? true : o.visibleInForm}
                        disabled={locked}
                        onCheckedChange={(v) => patchCore(o.key, { visibleInForm: !!v })}
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Checkbox
                        checked={def.remoteSupported && o.visibleInRemote}
                        disabled={!def.remoteSupported}
                        onCheckedChange={(v) => patchCore(o.key, { visibleInRemote: !!v })}
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Checkbox
                        checked={def.parseReviewSupported && o.visibleInParseReview}
                        disabled={!def.parseReviewSupported}
                        onCheckedChange={(v) => patchCore(o.key, { visibleInParseReview: !!v })}
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Checkbox
                        checked={!!o.required || (locked && !!def.defaultRequired)}
                        disabled={locked && !!def.defaultRequired}
                        onCheckedChange={(v) => patchCore(o.key, { required: !!v })}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end gap-0.5">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveCore(o.key, -1)} disabled={i === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveCore(o.key, 1)} disabled={i === sortedCore.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============ Custom fields ============ */}
        <div className="space-y-3 pt-2 border-t">
          <div>
            <h3 className="text-sm font-semibold">Custom fields</h3>
            <p className="text-xs text-muted-foreground">
              Extra fields stored on each job. Toggle whether each shows on the jobs list and in DataBoard widget options.
            </p>
          </div>

          {loading ? null : fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom fields yet — add your first one below.</p>
          ) : (
            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={f.id} className="rounded-md border p-3 space-y-2 bg-muted/20">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 sm:col-span-4">
                      <label className="text-[11px] text-muted-foreground">Label</label>
                      <Input value={f.label} onChange={(e) => update(f.id, { label: e.target.value })} className="h-9" />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <label className="text-[11px] text-muted-foreground">Type</label>
                      <Select value={f.type} onValueChange={(v) => update(f.id, { type: v as CustomFieldType })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-6 sm:col-span-4">
                      <label className="text-[11px] text-muted-foreground">Internal key</label>
                      <Input value={f.key} onChange={(e) => update(f.id, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })} className="h-9 font-mono text-xs" />
                    </div>
                    <div className="col-span-12 sm:col-span-1 flex sm:flex-col gap-1 sm:items-end">
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(f.id, -1)} disabled={i === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(f.id, 1)} disabled={i === fields.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {f.type === "select" && (
                    <div>
                      <label className="text-[11px] text-muted-foreground">Options (comma-separated)</label>
                      <Input
                        value={(f.options || []).join(", ")}
                        onChange={(e) => update(f.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                        className="h-9"
                        placeholder="Option A, Option B, Option C"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={f.visibleInForm} onCheckedChange={(v) => update(f.id, { visibleInForm: !!v })} />
                      Show in form
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={f.visibleInTable} onCheckedChange={(v) => update(f.id, { visibleInTable: !!v })} />
                      Show in jobs table
                    </label>
                    {f.type === "number" && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={!!f.visibleInDataboard} onCheckedChange={(v) => update(f.id, { visibleInDataboard: !!v })} />
                        Available in DataBoard widgets
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={!!f.required} onCheckedChange={(v) => update(f.id, { required: !!v })} />
                      Required
                    </label>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => remove(f.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={add}>
              <Plus className="h-4 w-4 mr-2" /> Add custom field
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save form"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
