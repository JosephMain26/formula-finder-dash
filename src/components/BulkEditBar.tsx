import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface BulkEditBarProps {
  selectedIds: string[];
  onClear: () => void;
  onChanged: () => void;
  statuses: string[];
}

export function BulkEditBar({ selectedIds, onClear, onChanged, statuses }: BulkEditBarProps) {
  const [busy, setBusy] = useState(false);
  const { can } = useAuth();
  const canEditPercentage = can("jobs.edit_percentage");

  if (selectedIds.length === 0) return null;

  async function applyUpdate(patch: Record<string, any>) {
    setBusy(true);
    await (supabase as any).from("jobs").update(patch).in("id", selectedIds);
    setBusy(false);
    onChanged();
  }

  async function handleDelete() {
    if (!confirm(`Delete ${selectedIds.length} job(s)? This cannot be undone.`)) return;
    setBusy(true);
    await supabase.from("jobs").delete().in("id", selectedIds);
    setBusy(false);
    onClear();
    onChanged();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-accent/40 border rounded-lg">
      <span className="text-sm font-medium mr-2">{selectedIds.length} selected</span>

      <Select disabled={busy} onValueChange={(v) => applyUpdate({ status: v })}>
        <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Set status" /></SelectTrigger>
        <SelectContent>
          {(statuses.length ? statuses : ["Pending", "Completed", "Cancelled"]).map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select disabled={busy} onValueChange={(v) => applyUpdate({ paid: v === "yes" })}>
        <SelectTrigger className="h-8 w-[120px]"><SelectValue placeholder="Set paid" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Paid</SelectItem>
          <SelectItem value="no">Unpaid</SelectItem>
        </SelectContent>
      </Select>

      {canEditPercentage && (
        <TechPercentInput disabled={busy} onApply={(n) => applyUpdate({ manual_percentage: n })} />
      )}

      <PaymentInput disabled={busy} onApply={(p) => applyUpdate({ payment: p })} />

      <Button variant="destructive" size="sm" disabled={busy} onClick={handleDelete}>
        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
      </Button>

      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">
        <X className="h-3.5 w-3.5 mr-1" /> Clear
      </Button>
    </div>
  );
}

function TechPercentInput({ onApply, disabled }: { onApply: (n: number) => void; disabled: boolean }) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number" step="0.001" min="0" max="100" placeholder="Tech %" value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-8 w-[90px]"
      />
      <Button size="sm" variant="outline" disabled={disabled || v === ""} onClick={() => { onApply(Number(v)); setV(""); }}>Apply</Button>
    </div>
  );
}

function PaymentInput({ onApply, disabled }: { onApply: (p: string) => void; disabled: boolean }) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-1">
      <Input
        placeholder="Payment method" value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-8 w-[140px]"
      />
      <Button size="sm" variant="outline" disabled={disabled || !v.trim()} onClick={() => { onApply(v.trim()); setV(""); }}>Apply</Button>
    </div>
  );
}
