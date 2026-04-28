import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import {
  loadCustomFields, saveCustomFields, newCustomField,
  type CustomField, type CustomFieldType,
} from "@/lib/jobSchema";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCustomFields().then((f) => { setFields(f); setLoading(false); }); }, []);

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

  async function save() {
    setSaving(true);
    const cleaned = fields.map((f) => ({ ...f, label: f.label.trim() || "Untitled", key: f.key.trim() || `x_${f.id}` }));
    setFields(cleaned);
    await saveCustomFields(cleaned);
    setSaving(false);
    toast.success("Job form saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Form Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Add custom fields that appear on the Add/Edit Job dialog. Toggle whether each field shows in the jobs list and the DataBoard widget options.
          The built-in core fields (Date, Marketer, Tech, Price, etc.) always remain in the form.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : fields.length === 0 ? (
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
            <Plus className="h-4 w-4 mr-2" /> Add field
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Form"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
