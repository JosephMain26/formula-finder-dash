import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  loadPaymentDefaults, savePaymentDefaults, EMPTY_PAYMENT_DEFAULTS,
  type PaymentDefaultsSetting, type CollectorRecipient,
} from "@/lib/settings";

const RECIPIENTS: CollectorRecipient[] = ["Marketer", "Office", "Tech"];

export function PaymentDefaultsManager() {
  const [settings, setSettings] = useState<PaymentDefaultsSetting>(EMPTY_PAYMENT_DEFAULTS);
  const [marketers, setMarketers] = useState<string[]>([]);
  const [techs, setTechs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, { data: comps }, { data: tch }] = await Promise.all([
        loadPaymentDefaults(),
        supabase.from("companies").select("company_name").order("company_name"),
        supabase.from("technicians").select("tech_name").order("tech_name"),
      ]);
      setSettings(s);
      setMarketers(((comps as any[]) || []).map((c) => (c.company_name || "").trim()).filter(Boolean));
      setTechs(((tch as any[]) || []).map((t) => (t.tech_name || "").trim()).filter(Boolean));
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await savePaymentDefaults(settings);
      toast.success("Payment collection defaults saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function ruleBlock(
    kind: "byMarketer" | "byTech",
    title: string,
    description: string,
    options: string[]
  ) {
    const map = settings[kind];
    const entries = Object.entries(map);
    const available = options.filter((o) => !(o in map));
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-sm">{title}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!available.length}
            onClick={() =>
              setSettings((s) => ({ ...s, [kind]: { ...s[kind], [available[0]]: s.default } }))
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add rule
          </Button>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rules yet — the general default is used.</p>
        ) : (
          entries.map(([name, rec]) => (
            <div key={name} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <Select
                value={name}
                onValueChange={(v) =>
                  setSettings((s) => {
                    const next = { ...s[kind] };
                    delete next[name];
                    next[v] = rec;
                    return { ...s, [kind]: next };
                  })
                }
              >
                <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[name, ...options.filter((o) => o !== name && !(o in map))].map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">collected by</span>
              <Select
                value={rec}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, [kind]: { ...s[kind], [name]: v as CollectorRecipient } }))
                }
              >
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECIPIENTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="ml-auto text-destructive"
                onClick={() =>
                  setSettings((s) => {
                    const next = { ...s[kind] };
                    delete next[name];
                    return { ...s, [kind]: next };
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment collection</CardTitle>
        <CardDescription>
          Choose who is assumed to collect the money on a new job. A marketer rule wins over a
          technician rule, and both win over the general default. You can still change it per job.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div>
              <Label className="text-sm">General default</Label>
              <Select
                value={settings.default}
                onValueChange={(v) => setSettings((s) => ({ ...s, default: v as CollectorRecipient }))}
              >
                <SelectTrigger className="h-9 mt-1 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECIPIENTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {ruleBlock("byMarketer", "Rules by marketer", "Applies when the job's marketer matches.", marketers)}
            {ruleBlock("byTech", "Rules by technician", "Applies when no marketer rule matched.", techs)}

            <Button onClick={save} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
