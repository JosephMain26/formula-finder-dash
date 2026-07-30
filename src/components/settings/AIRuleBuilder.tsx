import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Trash2, Plus, Loader2, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  loadAITraining,
  saveAITraining,
  newStructuredRule,
  normalizeStructuredRule,
  applyStructuredRules,
  RULE_SOURCES,
  RULE_TARGET_FIELDS,
  type AITrainingSetting,
  type StructuredRule,
} from "@/lib/aiTraining";
import { compileAIRule } from "@/lib/aiRules.functions";

export function AIRuleBuilder() {
  const [training, setTraining] = useState<AITrainingSetting | null>(null);
  const [rules, setRules] = useState<StructuredRule[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [lists, setLists] = useState<{ companies: string[]; technicians: string[]; jobTypes: string[] }>({
    companies: [],
    technicians: [],
    jobTypes: [],
  });

  useEffect(() => {
    (async () => {
      const [t, c, tech, jt] = await Promise.all([
        loadAITraining(),
        supabase.from("companies").select("company_name"),
        supabase.from("technicians").select("tech_name"),
        supabase.from("job_types").select("name"),
      ]);
      setTraining(t);
      setRules((t.structuredRules || []).map(normalizeStructuredRule));
      setLists({
        companies: (c.data || []).map((x: any) => x.company_name).filter(Boolean),
        technicians: (tech.data || []).map((x: any) => x.tech_name).filter(Boolean),
        jobTypes: (jt.data || []).map((x: any) => x.name).filter(Boolean),
      });
    })();
  }, []);

  async function persist(next: StructuredRule[]) {
    setRules(next);
    if (!training) return;
    const merged = { ...training, structuredRules: next };
    setTraining(merged);
    await saveAITraining(merged);
  }

  async function generate() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      const compiled = await compileAIRule({ data: { text, ...lists } });
      const rule = normalizeStructuredRule(
        newStructuredRule({ text, when: compiled.when as any, then: compiled.then as any })
      );
      await persist([rule, ...rules]);
      setDraft("");
      toast.success("Rule added — it will be enforced automatically from now on");
    } catch (e: any) {
      toast.error(String(e?.message || "Could not build that rule"));
    } finally {
      setBusy(false);
    }
  }

  function update(id: string, patch: Partial<StructuredRule>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function runTest() {
    const { result, fired } = applyStructuredRules({}, testText, rules);
    if (!fired.length) {
      setTestResult("No rules matched this message.");
      return;
    }
    const names = fired.map((id) => rules.find((r) => r.id === id)?.text || id);
    const changes = Object.entries(result)
      .map(([k, v]) => `${k} = ${v}`)
      .join("\n");
    setTestResult(`Fired: ${names.join(" | ")}\n\n${changes}`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Rule Builder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Write a rule in plain English. AI turns it into a fixed rule once — after that the app
            enforces it with plain logic on every parse, so it can never be ignored.
          </p>
          <Textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`e.g. "If the message mentions Elite, the marketer is Elite Doors"`}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => persist([newStructuredRule(), ...rules])}
            >
              <Plus className="h-4 w-4 mr-1" /> Add blank rule
            </Button>
            <Button size="sm" onClick={generate} disabled={busy || !draft.trim()}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Build rule
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Rules ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground">No rules yet.</p>
          )}
          {rules.map((r) => (
            <div key={r.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={r.enabled} onCheckedChange={(v) => update(r.id, { enabled: v })} />
                <Input
                  className="h-8"
                  value={r.text}
                  placeholder="Rule description"
                  onChange={(e) => update(r.id, { text: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => persist(rules.filter((x) => x.id !== r.id))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                <Select value={r.when.source} onValueChange={(v) => update(r.id, { when: { ...r.when, source: v } })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={r.when.op} onValueChange={(v) => update(r.id, { when: { ...r.when, op: v } })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="equals">equals</SelectItem>
                    <SelectItem value="any">always</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8"
                  placeholder="value"
                  value={r.when.value}
                  onChange={(e) => update(r.id, { when: { ...r.when, value: e.target.value } })}
                />
                <Select value={r.then.field} onValueChange={(v) => update(r.id, { then: { ...r.then, field: v } })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="set field" /></SelectTrigger>
                  <SelectContent>
                    {RULE_TARGET_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={r.then.mode} onValueChange={(v) => update(r.id, { then: { ...r.then, mode: v } })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">set to</SelectItem>
                    <SelectItem value="prefix">prefix with</SelectItem>
                    <SelectItem value="append">append</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8"
                  placeholder="value"
                  value={r.then.value}
                  onChange={(e) => update(r.id, { then: { ...r.then, value: e.target.value } })}
                />
              </div>
            </div>
          ))}
          {rules.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => persist(rules).then(() => toast.success("Saved"))}>Save rules</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> Test rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={4}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Paste a sample message to see which rules fire..."
          />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={runTest} disabled={!testText.trim()}>Run test</Button>
          </div>
          {testResult && (
            <pre className="text-xs bg-muted rounded-md p-2 whitespace-pre-wrap">{testResult}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
