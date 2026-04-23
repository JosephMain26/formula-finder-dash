import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type FieldType = "text" | "number" | "date" | "select";

interface EditableCellProps {
  jobId: string;
  field: string;
  value: string | number | null;
  type?: FieldType;
  options?: string[];
  display: React.ReactNode;
  className?: string;
  align?: "left" | "right";
  onSaved: () => void;
}

export function EditableCell({
  jobId,
  field,
  value,
  type = "text",
  options,
  display,
  className,
  align = "left",
  onSaved,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value == null ? "" : String(value));
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function commit(next: string) {
    const original = value == null ? "" : String(value);
    if (next === original) {
      setEditing(false);
      return;
    }
    setSaving(true);
    let payload: any;
    if (type === "number") {
      payload = next === "" ? null : Number(next);
      if (payload != null && Number.isNaN(payload)) {
        setSaving(false);
        setEditing(false);
        return;
      }
    } else {
      payload = next === "" ? null : next;
    }
    await supabase.from("jobs").update({ [field]: payload } as any).eq("id", jobId);
    setSaving(false);
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <div
        onDoubleClick={() => setEditing(true)}
        className={`cursor-text select-none ${align === "right" ? "text-right" : ""} ${className ?? ""}`}
        title="Double-click to edit"
      >
        {display}
      </div>
    );
  }

  if (type === "select" && options) {
    return (
      <Select
        defaultOpen
        value={draft}
        onValueChange={(v) => { setDraft(v); commit(v); }}
        onOpenChange={(o) => { if (!o && !saving) setEditing(false); }}
      >
        <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      ref={inputRef}
      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
      step={type === "number" ? "0.01" : undefined}
      value={draft}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(draft); }
        else if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
      }}
      className={`h-7 text-sm ${align === "right" ? "text-right" : ""}`}
    />
  );
}
