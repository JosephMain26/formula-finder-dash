import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog, type InstallGroup, type InstallSubItem, type InstallModel } from "@/lib/installCatalog";
import { toast } from "sonner";

export function InstallationCatalogManager() {
  const [groups, setGroups] = useState<InstallGroup[]>([]);
  const [subItems, setSubItems] = useState<InstallSubItem[]>([]);
  const [models, setModels] = useState<InstallModel[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newColor, setNewColor] = useState<Record<string, string>>({});

  async function refresh() {
    const c = await loadCatalog();
    setGroups(c.groups);
    setSubItems(c.subItems);
    setModels(c.models);
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
  async function addColor(modelId: string) {
    const v = (newColor[modelId] || "").trim();
    if (!v) return;
    const m = models.find((x) => x.id === modelId);
    if (!m) return;
    const colors = [...(m.colors || []), v];
    await (supabase as any).from("install_models").update({ colors }).eq("id", modelId);
    setNewColor((p) => ({ ...p, [modelId]: "" }));
    refresh();
  }
  async function removeColor(modelId: string, color: string) {
    const m = models.find((x) => x.id === modelId);
    if (!m) return;
    const colors = (m.colors || []).filter((c) => c !== color);
    await (supabase as any).from("install_models").update({ colors }).eq("id", modelId);
    refresh();
  }

  const groupSubs = subItems.filter((s) => s.group_id === activeGroupId);
  const groupModels = models.filter((m) => m.group_id === activeGroupId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Installation Catalog</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Create item groups (e.g. Garage Door, Opener), their sub-items (Tracks, Rollers…), and models with available colors.
          These appear when adding installations to a job and inside installer messages.
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
                <div
                  key={g.id}
                  className={`flex items-center gap-1 rounded-md border p-1.5 ${activeGroupId === g.id ? "bg-muted" : ""}`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left text-sm px-1"
                    onClick={() => setActiveGroupId(g.id)}
                  >
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
                  <div className="text-xs font-medium text-muted-foreground mb-1">Models &amp; colors</div>
                  <div className="flex gap-2 mb-2">
                    <Input placeholder="e.g. Lincoln 2000" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} className="h-8" />
                    <Button size="sm" onClick={addModel} className="h-8"><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="space-y-2">
                    {groupModels.length === 0 && <p className="text-xs text-muted-foreground">No models.</p>}
                    {groupModels.map((m) => (
                      <div key={m.id} className="rounded-md border p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium flex-1">{m.name}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteModel(m.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(m.colors || []).map((c) => (
                            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                              {c}
                              <button type="button" onClick={() => removeColor(m.id, c)} className="hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add color (e.g. White)"
                            value={newColor[m.id] || ""}
                            onChange={(e) => setNewColor((p) => ({ ...p, [m.id]: e.target.value }))}
                            className="h-7 text-xs"
                          />
                          <Button size="sm" variant="outline" onClick={() => addColor(m.id)} className="h-7">Add</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
