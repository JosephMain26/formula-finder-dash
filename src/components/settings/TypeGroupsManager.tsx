import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Pencil, X, Check, GripVertical, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadTypeGroups, saveTypeGroups, type TypeGroups } from "@/lib/typeGroups";
import { toast } from "sonner";

type Named = { id: string; name: string };

const UNASSIGNED = "__unassigned__";

export function TypeGroupsManager() {
  const [compTypes, setCompTypes] = useState<Named[]>([]);
  const [jobTypes, setJobTypes] = useState<Named[]>([]);
  const [groups, setGroups] = useState<TypeGroups>({});
  const [newComp, setNewComp] = useState("");
  const [newJob, setNewJob] = useState("");
  const [editing, setEditing] = useState<{ table: "marketer_types" | "job_types"; id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState<string | null>(null);

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
    if (table === "marketer_types" && groups[oldName]) {
      const next = { ...groups };
      next[trimmed] = next[oldName];
      delete next[oldName];
      await saveTypeGroups(next);
      setGroups(next);
    }
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

  // Compute unassigned job types
  const assignedSet = useMemo(() => {
    const s = new Set<string>();
    for (const k of Object.keys(groups)) for (const n of groups[k] || []) s.add(n);
    return s;
  }, [groups]);
  const unassigned = jobTypes.filter((j) => !assignedSet.has(j.name));

  async function persist(next: TypeGroups) {
    setGroups(next);
    try {
      await saveTypeGroups(next);
    } catch (e) {
      toast.error("Failed to save mapping");
      refresh();
    }
  }

  // DnD: payload encodes "<sourceComp>|<jobName>"
  function onDragStart(e: React.DragEvent, fromComp: string, jobName: string) {
    e.dataTransfer.setData("text/plain", `${fromComp}|${jobName}`);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDrop(e: React.DragEvent, toComp: string) {
    e.preventDefault();
    setDragOver(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    const [fromComp, jobName] = raw.split("|");
    if (!jobName || fromComp === toComp) return;

    const next: TypeGroups = { ...groups };
    // Remove from source (if real comp)
    if (fromComp && fromComp !== UNASSIGNED) {
      next[fromComp] = (next[fromComp] || []).filter((n) => n !== jobName);
    }
    // Add to target (if real comp)
    if (toComp !== UNASSIGNED) {
      const cur = new Set(next[toComp] || []);
      cur.add(jobName);
      next[toComp] = Array.from(cur);
    }
    persist(next);
  }

  function toggleAssign(compName: string, jobName: string, checked: boolean) {
    const cur = new Set(groups[compName] || []);
    if (checked) cur.add(jobName); else cur.delete(jobName);
    persist({ ...groups, [compName]: Array.from(cur) });
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
            Drag a job type chip into a comp type to assign it. Drag back to "Unassigned" to remove.
            On touch devices, tap the chip menu to assign.
          </p>

          {compTypes.length === 0 || jobTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add at least one comp type and one job type above to set up mappings.</p>
          ) : (
            <div className="space-y-4">
              {/* Unassigned zone */}
              <DropZone
                title="Unassigned Job Types"
                isOver={dragOver === UNASSIGNED}
                onDragOver={(e) => { e.preventDefault(); setDragOver(UNASSIGNED); }}
                onDragLeave={() => setDragOver((p) => (p === UNASSIGNED ? null : p))}
                onDrop={(e) => onDrop(e, UNASSIGNED)}
              >
                {unassigned.length === 0 ? (
                  <span className="text-xs text-muted-foreground">All job types assigned.</span>
                ) : (
                  unassigned.map((j) => (
                    <Chip
                      key={j.id}
                      name={j.name}
                      onDragStart={(e) => onDragStart(e, UNASSIGNED, j.name)}
                      compTypes={compTypes}
                      groups={groups}
                      onToggle={(comp, checked) => toggleAssign(comp, j.name, checked)}
                    />
                  ))
                )}
              </DropZone>

              {/* Comp type columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {compTypes.map((c) => {
                  const items = (groups[c.name] || []).filter((n) => jobTypes.some((j) => j.name === n));
                  return (
                    <DropZone
                      key={c.id}
                      title={c.name}
                      isOver={dragOver === c.name}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(c.name); }}
                      onDragLeave={() => setDragOver((p) => (p === c.name ? null : p))}
                      onDrop={(e) => onDrop(e, c.name)}
                    >
                      {items.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Drop job types here</span>
                      ) : (
                        items.map((name) => (
                          <Chip
                            key={name}
                            name={name}
                            onDragStart={(e) => onDragStart(e, c.name, name)}
                            compTypes={compTypes}
                            groups={groups}
                            onToggle={(comp, checked) => toggleAssign(comp, name, checked)}
                          />
                        ))
                      )}
                    </DropZone>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DropZone({
  title, isOver, children, onDragOver, onDragLeave, onDrop,
}: {
  title: string;
  isOver: boolean;
  children: React.ReactNode;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-md border p-3 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border"}`}
    >
      <div className="text-sm font-medium mb-2">{title}</div>
      <div className="flex flex-wrap gap-2 min-h-8">
        {children}
      </div>
    </div>
  );
}

function Chip({
  name, onDragStart, compTypes, groups, onToggle,
}: {
  name: string;
  onDragStart: (e: React.DragEvent) => void;
  compTypes: Named[];
  groups: TypeGroups;
  onToggle: (compName: string, checked: boolean) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-1 text-xs cursor-grab active:cursor-grabbing select-none"
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <span>{name}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="ml-1 rounded p-0.5 hover:bg-muted" aria-label="Assign">
            <MoreVertical className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end">
          <div className="text-xs font-medium mb-1 px-1">Assign to</div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {compTypes.length === 0 && <p className="text-xs text-muted-foreground px-1">No comp types</p>}
            {compTypes.map((c) => {
              const checked = (groups[c.name] || []).includes(name);
              const id = `chip_${c.id}_${name}`;
              return (
                <label key={c.id} htmlFor={id} className="flex items-center gap-2 text-sm rounded px-1 py-1 hover:bg-muted cursor-pointer">
                  <Checkbox id={id} checked={checked} onCheckedChange={(v) => onToggle(c.name, !!v)} />
                  <span className="truncate">{c.name}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
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
