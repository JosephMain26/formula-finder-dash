import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  loadBillingTemplates, saveBillingTemplates, newBillingTemplate, type BillingTemplate,
} from "@/lib/settings";

/** Manage reusable Notes / Terms templates used on estimates and invoices. */
export function BillingTemplatesManager() {
  const [templates, setTemplates] = useState<BillingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBillingTemplates().then((t) => { setTemplates(t); setLoading(false); });
  }, []);

  function update(id: string, patch: Partial<BillingTemplate>) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function setDefault(t: BillingTemplate, on: boolean) {
    setTemplates((prev) =>
      prev.map((x) =>
        x.id === t.id ? { ...x, isDefault: on } : x.kind === t.kind && on ? { ...x, isDefault: false } : x,
      ),
    );
  }

  async function persist(next?: BillingTemplate[]) {
    const list = next ?? templates;
    setSaving(true);
    try {
      await saveBillingTemplates(list);
      toast.success("Templates saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const group = (kind: "notes" | "terms") => templates.filter((t) => t.kind === kind);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Estimate &amp; Invoice Templates</span>
          <Button size="sm" onClick={() => persist()} disabled={saving || loading}>
            {saving ? "Saving…" : "Save all"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Reusable Notes and Terms blocks. Pick them from a dropdown when creating an estimate or invoice; a default is
          filled in automatically on new documents.
        </p>

        {(["notes", "terms"] as const).map((kind) => (
          <div key={kind} className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{kind === "notes" ? "Notes templates" : "Terms templates"}</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplates((p) => [...p, newBillingTemplate(kind)])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : group(kind).length === 0 ? (
              <p className="text-sm text-muted-foreground">No {kind} templates yet.</p>
            ) : (
              group(kind).map((t) => (
                <div key={t.id} className="rounded-md border p-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <Label className="text-[11px] text-muted-foreground">Template name</Label>
                      <Input value={t.name} onChange={(e) => update(t.id, { name: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Applies to</Label>
                      <Select
                        value={t.appliesTo}
                        onValueChange={(v) => update(t.id, { appliesTo: v as BillingTemplate["appliesTo"] })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Estimates &amp; invoices</SelectItem>
                          <SelectItem value="estimate">Estimates only</SelectItem>
                          <SelectItem value="invoice">Invoices only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Content</Label>
                    <Textarea rows={3} value={t.body} onChange={(e) => update(t.id, { body: e.target.value })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!t.isDefault} onCheckedChange={(v) => setDefault(t, !!v)} />
                      Use as default on new documents
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const next = templates.filter((x) => x.id !== t.id);
                        setTemplates(next);
                        persist(next);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
