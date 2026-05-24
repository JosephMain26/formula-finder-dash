import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadTypeGroups, saveTypeGroups, type TypeGroups } from "@/lib/typeGroups";
import { toast } from "sonner";

type Named = { id: string; name: string };

export function TypeGroupsManager() {
  const [compTypes, setCompTypes] = useState<Named[]>([]);
  const [jobTypes, setJobTypes] = useState<Named[]>([]);
  const [groups, setGroups] = useState<TypeGroups>({});
  const [newComp, setNewComp] = useState("");
  const [newJob, setNewJob] = useState("");
  const [editing, setEditing] = useState<{ table: "marketer_types" | "job_types"; id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [mt, jt, g] = await Promise.all([
      (supabase as any).from("marketer_types").select("id,name").order("name"),
      supabase.from("job_types").select("id,name").order("name"),
      loadTypeGroups(),
    ]);
    setCompTypes((mt.data as Named[]) || []);
    setJobTypes((jt.data as Named[]) || []);
    setGroups(g);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function addComp() {
    const name = newComp.trim();
    if (!name) return;
    await (supabase as any).from("marketer_types").insert({ name });
    setNewComp("");
    refresh();
  }

  async function addJob() {
    const name = newJob.trim();
    if (!name) return;
    await supabase.from("job_types").insert({ name } as any);
    setNewJob("");
    refresh();
  }

  async function renameRow(table: "marketer_types" | "job_types", id: string, oldName: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === oldName) { setEditing(null); return; }
    await (supabase as any).from(table).update({ name: trimmed }).eq("id", id);
    // If comp type renamed, migrate mapping key
    if (table === "marketer_types" && groups[oldName]) {
      const next = { ...groups };
      next[trimmed] = next[oldName];
      delete next[oldName];
      await saveTypeGroups(next);
      setGroups(next);
    }
    // If job type renamed, update names inside groups
    if (table === "job_types") {
      const next: TypeGroups = {};
      let changed = false;
      for (const k of Object.keys(groups)) {
        next[k] = groups[k].map((n) => {
          if (n === oldName) { changed = true; return trimmed; }
          return n;
        });
      }
      if (changed) { await saveTypeGroups(next); setGroups(next); }
    }
    setEditing(null);
    refresh();
  }

  async function deleteRow(table: "marketer_types" | "job_types", id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await (supabase as any).from(table).delete().eq("id", id);
    if (table === "marketer_types" && groups[name]) {
      const next = { ...groups };
      delete next[name];
      await saveTypeGroups(next);
      setGroups(next);
    }
    if (table === "job_types") {
      const next: TypeGroups = {};
      let changed = false;
      for (const k of Object.keys(groups)) {
        const filtered = groups[k].filter((n) => n !== name);
        if (filtered.length !== groups[k].length) changed = true;
        next[k] = filtered;
      }
      if (changed) { await saveTypeGroups(next); setGroups(next); }
    }
    refresh();
  }

  async function toggleMapping(compName: string, jobName: string, checked: boolean) {
    const current = new Set(groups[compName] || []);
    if (checked) current.add(jobName); else current.delete(jobName);
    const next = { ...groups, [compName]: Array.from(current) };
    setGroups(next);
    await saveTypeGroups(next);
  }

  async function saveAll() {
    await saveTypeGroups(groups);
    toast.success("Job type groups saved");
  }

  if (loading) {
    return <Card><CardContent className="py-6"><p className="text-sm text-muted-foreground">Loading…</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Comp Types &amp; Job Types</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Comp Types */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Comp Types</h3>
              <div className="flex gap-2">
                <Input value={newComp} onChange={(e) => setNewComp(e.target.value)} placeholder="New comp type" className="h-9" />
                <Button type="button" size="sm" onClick={addComp}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1">
                {compTypes.length === 0 && <p className="text-xs text-muted-foreground">No comp types yet.</p>}
                {compTypes.map((c) => (
                  <RowEditor
                    key={c.id}
                    item={c}
                    isEditing={editing?.table === "marketer_types" && editing.id === c.id}
                    editValue={editing?.table === "marketer_types" && editing.id === c.id ? editing.name : ""}
                    onStartEdit={() => setEditing({ table: "marketer_types", id: c.id, name: c.name })}
                    onChangeEdit={(v) => setEditing(editing ? { ...editing, name: v } : null)}
                    onSave={() => renameRow("marketer_types", c.id, c.name, editing?.name || "")}
                    onCancel={() => setEditing(null)}
                    onDelete={() => deleteRow("marketer_types", c.id, c.name)}
                  />
                ))}
              </div>
            </div>

            {/* Job Types */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Job Types</h3>
              <div className="flex gap-2">
                <Input value={newJob} onChange={(e) => setNewJob(e.target.value)} placeholder="New job type" className="h-9" />
                <Button type="button" size="sm" onClick={addJob}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1">
                {jobTypes.length === 0 && <p className="text-xs text-muted-foreground">No job types yet.</p>}
                {jobTypes.map((j) => (
                  <RowEditor
                    key={j.id}
                    item={j}
                    isEditing={editing?.table === "job_types" && editing.id === j.id}
                    editValue={editing?.table === "job_types" && editing.id === j.id ? editing.name : ""}
                    onStartEdit={() => setEditing({ table: "job_types", id: j.id, name: j.name })}
                    onChangeEdit={(v) => setEditing(editing ? { ...editing, name: v } : null)}
                    onSave={() => renameRow("job_types", j.id, j.name, editing?.name || "")}
                    onCancel={() => setEditing(null)}
                    onDelete={() => deleteRow("job_types", j.id, j.name)}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comp → Job Type Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Tick the job types that belong to each comp type. In the Job form, picking a Comp Type
            will filter the Job Type list to its mapped options. Leave a comp type with nothing
            ticked to show all job types.
          </p>
          {compTypes.length === 0 || jobTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add at least one comp type and one job type above to set up mappings.</p>
          ) : (
            <div className="space-y-3">
              {compTypes.map((c) => {
                const selected = new Set(groups[c.name] || []);
                return (
                  <div key={c.id} className="rounded-md border p-3">
                    <div className="text-sm font-medium mb-2">{c.name}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {jobTypes.map((j) => {
                        const id = `map_${c.id}_${j.id}`;
                        return (
                          <label key={j.id} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              id={id}
                              checked={selected.has(j.name)}
                              onCheckedChange={(v) => toggleMapping(c.name, j.name, !!v)}
                            />
                            <span className="truncate">{j.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div>
                <Button size="sm" onClick={saveAll}>Save mapping</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RowEditor({
  item, isEditing, editValue, onStartEdit, onChangeEdit, onSave, onCancel, onDelete,
}: {
  item: Named;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onChangeEdit: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border rounded-md p-2">
      {isEditing ? (
        <>
          <Input value={editValue} onChange={(e) => onChangeEdit(e.target.value)} className="h-8 text-sm flex-1" />
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={onSave}><Check className="h-3 w-3" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}><X className="h-3 w-3" /></Button>
        </>
      ) : (
        <>
          <span className="text-sm flex-1 truncate">{item.name}</span>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onStartEdit}><Pencil className="h-3 w-3" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete}><Trash2 className="h-3 w-3 text-destructive" /></Button>
        </>
      )}
    </div>
  );
}
