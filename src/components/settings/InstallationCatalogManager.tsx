import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog, formatSize, type InstallGroup, type InstallSubItem, type InstallModel, type InstallColor, type InstallSize } from "@/lib/installCatalog";
import { toast } from "sonner";

export function InstallationCatalogManager() {
  const [groups, setGroups] = useState<InstallGroup[]>([]);
  const [subItems, setSubItems] = useState<InstallSubItem[]>([]);
  const [models, setModels] = useState<InstallModel[]>([]);
  const [colors, setColors] = useState<InstallColor[]>([]);
  const [sizes, setSizes] = useState<InstallSize[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newColorName, setNewColorName] = useState("");
  const [newSize, setNewSize] = useState({ width: "", height: "", label: "" });

  async function refresh() {
    const c = await loadCatalog();
    setGroups(c.groups);
    setSubItems(c.subItems);
    setModels(c.models);
    setColors(c.colors);
    setSizes(c.sizes);
    if (!activeGroupId && c.groups.length) setActiveGroupId(c.groups[0].id);
  }

  useEffect(() => { refresh(); }, []);

  async function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    const { data, error } = await (supabase as any).from("install_groups").insert({ name }).select().single();
    if (error) return toast.error(error.message);
    setNewGroup("");
    setActiveGroupId(data.id);
    refresh();
  }
  async function deleteGroup(id: string) {
    if (!confirm("Delete this group and all its sub-items and models?")) return;
    await (supabase as any).from("install_groups").delete().eq("id", id);
    if (activeGroupId === id) setActiveGroupId(null);
    refresh();
  }
  async function renameGroup(id: string, name: string) {
    await (supabase as any).from("install_groups").update({ name }).eq("id", id);
    refresh();
  }

  async function addSub() {
    const name = newSub.trim();
    if (!name || !activeGroupId) return;
    const { error } = await (supabase as any).from("install_sub_items").insert({ name, group_id: activeGroupId });
    if (error) return toast.error(error.message);
    setNewSub("");
    refresh();
  }
  async function deleteSub(id: string) {
    await (supabase as any).from("install_sub_items").delete().eq("id", id);
    refresh();
  }

  async function addModel() {
    const name = newModelName.trim();
    if (!name || !activeGroupId) return;
    const { error } = await (supabase as any).from("install_models").insert({ name, group_id: activeGroupId, colors: [] });
    if (error) return toast.error(error.message);
    setNewModelName("");
    refresh();
  }
  async function deleteModel(id: string) {
    await (supabase as any).from("install_models").delete().eq("id", id);
    refresh();
  }

  async function addColor() {
    const name = newColorName.trim();
    if (!name) return;
    const { error } = await (supabase as any).from("install_colors").insert({ name });
    if (error) return toast.error(error.message);
    setNewColorName("");
    refresh();
  }
  async function deleteColor(id: string) {
    await (supabase as any).from("install_colors").delete().eq("id", id);
    refresh();
  }
  async function renameColor(id: string, name: string) {
    if (!name.trim()) return;
    await (supabase as any).from("install_colors").update({ name: name.trim() }).eq("id", id);
    refresh();
  }

  async function addSize() {
    const w = newSize.width.trim();
    const h = newSize.height.trim();
    if (!w || !h) return toast.error("Width and height required");
    const { error } = await (supabase as any).from("install_sizes").insert({
      width: w, height: h, label: newSize.label.trim() || null,
    });
    if (error) return toast.error(error.message);
    setNewSize({ width: "", height: "", label: "" });
    refresh();
  }
  async function deleteSize(id: string) {
    await (supabase as any).from("install_sizes").delete().eq("id", id);
    refresh();
  }
  async function updateSize(id: string, patch: Partial<InstallSize>) {
    await (supabase as any).from("install_sizes").update(patch).eq("id", id);
    refresh();
  }

  const groupSubs = subItems.filter((s) => s.group_id === activeGroupId);
  const groupModels = models.filter((m) => m.group_id === activeGroupId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Installation Catalog</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Item groups (e.g. Garage Door, Opener), their sub-items checklist, and models. Colors and sizes are global — managed below.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Groups */}
            <div className="md:col-span-1 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Groups</div>
              <div className="flex gap-2">
                <Input placeholder="New group" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className="h-8" />
                <Button size="sm" onClick={addGroup} className="h-8"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="space-y-1">
                {groups.length === 0 && <p className="text-xs text-muted-foreground">No groups yet.</p>}
                {groups.map((g) => (
                  <div key={g.id} className={`flex items-center gap-1 rounded-md border p-1.5 ${activeGroupId === g.id ? "bg-muted" : ""}`}>
                    <button type="button" className="flex-1 text-left text-sm px-1" onClick={() => setActiveGroupId(g.id)}>
                      {g.name}
                    </button>
                    <Input
                      defaultValue={g.name}
                      onBlur={(e) => { if (e.target.value.trim() && e.target.value !== g.name) renameGroup(g.id, e.target.value.trim()); }}
                      className="h-7 text-xs w-24"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteGroup(g.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Sub-items + models for active group */}
            <div className="md:col-span-2 space-y-4">
              {!activeGroupId ? (
                <p className="text-sm text-muted-foreground">Select or create a group to manage sub-items and models.</p>
              ) : (
                <>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Sub-items (checklist for installer)</div>
                    <div className="flex gap-2 mb-2">
                      <Input placeholder="e.g. Tracks" value={newSub} onChange={(e) => setNewSub(e.target.value)} className="h-8" />
                      <Button size="sm" onClick={addSub} className="h-8"><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {groupSubs.length === 0 && <p className="text-xs text-muted-foreground">No sub-items.</p>}
                      {groupSubs.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
                          {s.name}
                          <button type="button" onClick={() => deleteSub(s.id)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Models</div>
                    <div className="flex gap-2 mb-2">
                      <Input placeholder="e.g. Lincoln 2000" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} className="h-8" />
                      <Button size="sm" onClick={addModel} className="h-8"><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {groupModels.length === 0 && <p className="text-xs text-muted-foreground">No models.</p>}
                      {groupModels.map((m) => (
                        <span key={m.id} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
                          {m.name}
                          <button type="button" onClick={() => deleteModel(m.id)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global Colors</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Available for any installation, regardless of model.</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3 max-w-md">
            <Input placeholder="e.g. White" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} className="h-8" />
            <Button size="sm" onClick={addColor} className="h-8"><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {colors.length === 0 && <p className="text-xs text-muted-foreground">No colors yet.</p>}
            {colors.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
                <Input
                  defaultValue={c.name}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== c.name) renameColor(c.id, e.target.value); }}
                  className="h-6 text-xs border-0 bg-transparent w-24 p-0"
                />
                <button type="button" onClick={() => deleteColor(c.id)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Door Sizes</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Width × Height. Optional label overrides display (e.g. "Single car").</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3 items-end">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Width</label>
              <Input className="h-8 w-24" placeholder="16'" value={newSize.width} onChange={(e) => setNewSize((p) => ({ ...p, width: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Height</label>
              <Input className="h-8 w-24" placeholder="7'" value={newSize.height} onChange={(e) => setNewSize((p) => ({ ...p, height: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-[11px] font-medium text-muted-foreground">Label (optional)</label>
              <Input className="h-8" placeholder="Single car" value={newSize.label} onChange={(e) => setNewSize((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <Button size="sm" onClick={addSize} className="h-8"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
          </div>
          <div className="space-y-1.5">
            {sizes.length === 0 && <p className="text-xs text-muted-foreground">No sizes yet.</p>}
            {sizes.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-md border p-1.5">
                <Input
                  defaultValue={s.width}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== s.width) updateSize(s.id, { width: e.target.value.trim() }); }}
                  className="h-7 text-xs w-20"
                />
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  defaultValue={s.height}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== s.height) updateSize(s.id, { height: e.target.value.trim() }); }}
                  className="h-7 text-xs w-20"
                />
                <Input
                  defaultValue={s.label || ""}
                  placeholder="Label"
                  onBlur={(e) => { if ((e.target.value || null) !== (s.label || null)) updateSize(s.id, { label: e.target.value.trim() || null }); }}
                  className="h-7 text-xs flex-1"
                />
                <span className="text-xs text-muted-foreground">{formatSize(s)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSize(s.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
