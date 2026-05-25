import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, X } from "lucide-react";
import {
  loadCatalog,
  formatSize,
  type InstallGroup,
  type InstallSubItem,
  type InstallModel,
  type InstallColor,
  type InstallSize,
  type JobInstallation,
} from "@/lib/installCatalog";

interface Props {
  value: JobInstallation[];
  onChange: (next: JobInstallation[]) => void;
}

export function JobInstallationsEditor({ value, onChange }: Props) {
  const [groups, setGroups] = useState<InstallGroup[]>([]);
  const [subItems, setSubItems] = useState<InstallSubItem[]>([]);
  const [models, setModels] = useState<InstallModel[]>([]);
  const [colors, setColors] = useState<InstallColor[]>([]);
  const [sizes, setSizes] = useState<InstallSize[]>([]);
  const [customSub, setCustomSub] = useState<Record<number, string>>({});

  useEffect(() => {
    loadCatalog().then((c) => {
      setGroups(c.groups);
      setSubItems(c.subItems);
      setModels(c.models);
      setColors(c.colors);
      setSizes(c.sizes);
    });
  }, []);

  function update(idx: number, patch: Partial<JobInstallation>) {
    onChange(value.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addInstallation() {
    onChange([
      ...value,
      {
        group_id: null,
        group_name: null,
        model_id: null,
        model_name: null,
        color: null,
        system_type: null,
        size_id: null,
        size_label: null,
        notes: null,
        sub_items: [],
        sort_order: value.length,
      },
    ]);
  }

  function removeInstallation(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function pickGroup(idx: number, groupId: string) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const groupSubs = subItems.filter((s) => s.group_id === groupId);
    update(idx, {
      group_id: g.id,
      group_name: g.name,
      model_id: null,
      model_name: null,
      sub_items: groupSubs.map((s) => ({ sub_item_id: s.id, name: s.name, checked: true })),
    });
  }

  function pickModel(idx: number, modelId: string) {
    if (modelId === "__none__") {
      update(idx, { model_id: null, model_name: null });
      return;
    }
    const m = models.find((x) => x.id === modelId);
    if (!m) return;
    update(idx, { model_id: m.id, model_name: m.name });
  }

  function pickSize(idx: number, sizeId: string) {
    if (sizeId === "__none__") {
      update(idx, { size_id: null, size_label: null });
      return;
    }
    const s = sizes.find((x) => x.id === sizeId);
    if (!s) return;
    update(idx, { size_id: s.id, size_label: formatSize(s) });
  }

  function toggleSub(idx: number, subIdx: number) {
    const next = value[idx].sub_items.map((s, i) =>
      i === subIdx ? { ...s, checked: !s.checked } : s
    );
    update(idx, { sub_items: next });
  }

  function addCustomSub(idx: number) {
    const name = (customSub[idx] || "").trim();
    if (!name) return;
    update(idx, {
      sub_items: [...value[idx].sub_items, { name, checked: true }],
    });
    setCustomSub((p) => ({ ...p, [idx]: "" }));
  }

  function removeSub(idx: number, subIdx: number) {
    update(idx, {
      sub_items: value[idx].sub_items.filter((_, i) => i !== subIdx),
    });
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No installations on this job yet.
          {groups.length === 0 && " Add groups in Settings → Installation Catalog first."}
        </p>
      )}

      {value.map((it, idx) => {
        const groupModels = models.filter((m) => m.group_id === it.group_id);
        return (
          <div key={idx} className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Installation #{idx + 1}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeInstallation(idx)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Group</label>
                <Select value={it.group_id || ""} onValueChange={(v) => pickGroup(idx, v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Pick group" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Model</label>
                <Select
                  value={it.model_id || "__none__"}
                  onValueChange={(v) => pickModel(idx, v)}
                  disabled={!it.group_id}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={groupModels.length ? "Pick model" : "—"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {groupModels.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Color</label>
                {colors.length > 0 ? (
                  <Select
                    value={it.color || "__none__"}
                    onValueChange={(v) => update(idx, { color: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Pick color" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {colors.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      {it.color && !colors.some((c) => c.name === it.color) && (
                        <SelectItem value={it.color}>{it.color} (custom)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-9"
                    placeholder="Enter color"
                    value={it.color || ""}
                    onChange={(e) => update(idx, { color: e.target.value || null })}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">System</label>
                <Select
                  value={it.system_type || "__none__"}
                  onValueChange={(v) => update(idx, { system_type: v === "__none__" ? null : (v as any) })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Pick system" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    <SelectItem value="extension">Extension</SelectItem>
                    <SelectItem value="torsion">Torsion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Size</label>
                <Select
                  value={it.size_id || "__none__"}
                  onValueChange={(v) => pickSize(idx, v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={sizes.length ? "Pick size" : "Add sizes in Settings"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {sizes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{formatSize(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {it.group_id && (
              <div>
                <div className="text-[11px] font-medium text-muted-foreground mb-1">Items to install</div>
                <div className="flex flex-wrap gap-2">
                  {it.sub_items.map((s, si) => (
                    <label key={si} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={s.checked}
                        onCheckedChange={() => toggleSub(idx, si)}
                        className="h-3.5 w-3.5"
                      />
                      <span>{s.name}</span>
                      {!s.sub_item_id && (
                        <button type="button" onClick={() => removeSub(idx, si)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    className="h-7 text-xs"
                    placeholder="Add custom item"
                    value={customSub[idx] || ""}
                    onChange={(e) => setCustomSub((p) => ({ ...p, [idx]: e.target.value }))}
                  />
                  <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => addCustomSub(idx)}>Add</Button>
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
              <Input
                className="h-9"
                value={it.notes || ""}
                onChange={(e) => update(idx, { notes: e.target.value || null })}
                placeholder="Optional"
              />
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={addInstallation}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add installation
      </Button>
    </div>
  );
}
