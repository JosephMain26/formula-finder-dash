import { useEffect, useState } from "react";
import { ChevronsUpDown, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";

type Tag = { id: string; name: string };

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export function MarketerTypeSelect({ value, onChange }: Props) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function fetchTags() {
    const { data } = await (supabase as any)
      .from("marketer_types")
      .select("id,name")
      .order("name");
    setTags((data as Tag[]) || []);
  }

  useEffect(() => { fetchTags(); }, []);

  const selected = new Set(value || []);
  const q = query.trim().toLowerCase();
  const filtered = tags.filter((t) => !q || t.name.toLowerCase().includes(q));
  const exactMatch = tags.some((t) => t.name.toLowerCase() === q);

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange(Array.from(next));
  }

  async function createTag() {
    const name = query.trim();
    if (!name) return;
    const { data, error } = await (supabase as any)
      .from("marketer_types")
      .insert({ name })
      .select("id,name")
      .single();
    if (!error && data) {
      setTags((prev) => [...prev, data as Tag].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(Array.from(new Set([...(value || []), data.name])));
      setQuery("");
    } else {
      // If unique constraint, just select it
      onChange(Array.from(new Set([...(value || []), name])));
      setQuery("");
      fetchTags();
    }
  }

  async function renameTag(t: Tag) {
    const newName = editName.trim();
    if (!newName || newName === t.name) { setEditingId(null); return; }
    await (supabase as any).from("marketer_types").update({ name: newName }).eq("id", t.id);
    // Update any selected value that matched the old name
    if (selected.has(t.name)) {
      const next = Array.from(selected);
      const idx = next.indexOf(t.name);
      next[idx] = newName;
      onChange(next);
    }
    setEditingId(null);
    fetchTags();
  }

  async function deleteTag(t: Tag) {
    if (!confirm(`Delete tag "${t.name}"?`)) return;
    await (supabase as any).from("marketer_types").delete().eq("id", t.id);
    fetchTags();
  }

  return (
    <div className="space-y-2">
      {value && value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between font-normal">
            <span className="text-muted-foreground">
              {value?.length ? `${value.length} selected` : "Select types..."}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or create..."
            className="h-8 text-sm mb-2"
          />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filtered.length === 0 && !q && (
              <div className="text-xs text-muted-foreground px-2 py-3 text-center">No tags yet</div>
            )}
            {filtered.map((t) => (
              <div key={t.id} className="flex items-center gap-1 group">
                {editingId === t.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => renameTag(t)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => toggle(t.name)}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                    >
                      <div className={`h-4 w-4 rounded border flex items-center justify-center ${selected.has(t.name) ? "bg-primary border-primary" : "border-input"}`}>
                        {selected.has(t.name) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span>{t.name}</span>
                    </button>
                    {isAdmin && (
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => { setEditingId(t.id); setEditName(t.name); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => deleteTag(t)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {q && !exactMatch && (
              <button
                type="button"
                onClick={createTag}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left text-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                Create "{query.trim()}"
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
