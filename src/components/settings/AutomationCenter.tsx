import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Zap, History } from "lucide-react";
import { toast } from "sonner";
import {
  loadAutomations,
  upsertAutomation,
  deleteAutomation,
  loadAutomationRuns,
  type AutomationRun,
} from "@/lib/automations";
import {
  JOB_FIELDS,
  COMPARATORS,
  describeTrigger,
  describeAction,
  emptyAutomation,
  type Automation,
  type Action,
  type Condition,
} from "@/lib/automationEngine";
import { loadAutomations as loadReportAutomations, type ReportAutomation } from "@/lib/reportAutomations";

export function AutomationCenter() {
  const [items, setItems] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [reports, setReports] = useState<ReportAutomation[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [a, r, rep] = await Promise.all([
        loadAutomations(),
        loadAutomationRuns(30),
        loadReportAutomations().catch(() => []),
      ]);
      setItems(a);
      setRuns(r);
      setReports(rep as ReportAutomation[]);
    } catch (e: any) {
      toast.error(String(e?.message || "Could not load automations"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function patch(id: string, changes: Partial<Automation>) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  }

  async function save(a: Automation) {
    try {
      await upsertAutomation(a);
      toast.success("Saved");
      refresh();
    } catch (e: any) {
      toast.error(String(e?.message || "Save failed"));
    }
  }

  async function add() {
    try {
      await upsertAutomation(emptyAutomation() as any);
      refresh();
    } catch (e: any) {
      toast.error(String(e?.message || "Could not create"));
    }
  }

  async function remove(id: string) {
    await deleteAutomation(id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" /> Automations
          </CardTitle>
          <Button size="sm" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> New automation
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            If something happens → do this. Job triggers run the moment a job is saved; time and
            balance triggers are checked every 15 minutes.
          </p>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No automations yet.</p>
          )}

          {items.map((a) => (
            <div key={a.id} className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={a.enabled} onCheckedChange={(v) => patch(a.id, { enabled: v })} />
                <Input
                  className="h-9"
                  value={a.name}
                  onChange={(e) => patch(a.id, { name: e.target.value })}
                />
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {describeTrigger(a.trigger)}
                {(a.actions || []).length ? ` → ${a.actions.map(describeAction).join(", ")}` : ""}
              </p>

              {/* TRIGGER */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">If</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Select
                    value={a.trigger?.type || "job_created"}
                    onValueChange={(v) => patch(a.id, { trigger: { ...a.trigger, type: v as any } })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="job_created">Job is created</SelectItem>
                      <SelectItem value="job_updated">Job is updated</SelectItem>
                      <SelectItem value="field_changed">A field changes</SelectItem>
                      <SelectItem value="time_based">Time passes</SelectItem>
                      <SelectItem value="balance_threshold">Marketer balance threshold</SelectItem>
                    </SelectContent>
                  </Select>

                  {a.trigger?.type === "field_changed" && (
                    <>
                      <Select
                        value={a.trigger.field || ""}
                        onValueChange={(v) => patch(a.id, { trigger: { ...a.trigger, field: v } })}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Field" /></SelectTrigger>
                        <SelectContent>
                          {JOB_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-9"
                        placeholder="to value (optional)"
                        value={a.trigger.value || ""}
                        onChange={(e) => patch(a.id, { trigger: { ...a.trigger, value: e.target.value } })}
                      />
                    </>
                  )}

                  {a.trigger?.type === "time_based" && (
                    <>
                      <Input
                        className="h-9"
                        type="number"
                        placeholder="days after"
                        value={a.trigger.offsetDays ?? ""}
                        onChange={(e) =>
                          patch(a.id, { trigger: { ...a.trigger, offsetDays: Number(e.target.value) } })
                        }
                      />
                      <Select
                        value={a.trigger.dateField || "job_date"}
                        onValueChange={(v) => patch(a.id, { trigger: { ...a.trigger, dateField: v as any } })}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="job_date">Job date</SelectItem>
                          <SelectItem value="completed_at_date">Completion date</SelectItem>
                          <SelectItem value="scheduled_completion_date">Scheduled completion</SelectItem>
                          <SelectItem value="created_at">Created date</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  {a.trigger?.type === "balance_threshold" && (
                    <>
                      <Select
                        value={a.trigger.balanceOp || "gt"}
                        onValueChange={(v) => patch(a.id, { trigger: { ...a.trigger, balanceOp: v as any } })}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gt">above</SelectItem>
                          <SelectItem value="lt">below</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-9"
                        type="number"
                        placeholder="amount"
                        value={a.trigger.balanceAmount ?? ""}
                        onChange={(e) =>
                          patch(a.id, { trigger: { ...a.trigger, balanceAmount: Number(e.target.value) } })
                        }
                      />
                    </>
                  )}
                </div>
              </div>

              {/* CONDITIONS */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">And (optional)</p>
                {(a.conditions || []).map((c, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Select
                      value={c.field}
                      onValueChange={(v) => {
                        const next = [...a.conditions];
                        next[i] = { ...c, field: v };
                        patch(a.id, { conditions: next });
                      }}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Field" /></SelectTrigger>
                      <SelectContent>
                        {JOB_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select
                      value={c.op}
                      onValueChange={(v) => {
                        const next = [...a.conditions];
                        next[i] = { ...c, op: v as Condition["op"] };
                        patch(a.id, { conditions: next });
                      }}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COMPARATORS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-9"
                      placeholder="value"
                      value={c.value || ""}
                      onChange={(e) => {
                        const next = [...a.conditions];
                        next[i] = { ...c, value: e.target.value };
                        patch(a.id, { conditions: next });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => patch(a.id, { conditions: a.conditions.filter((_, x) => x !== i) })}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    patch(a.id, { conditions: [...(a.conditions || []), { field: "status", op: "eq", value: "" }] })
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add condition
                </Button>
              </div>

              {/* ACTIONS */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Then</p>
                {(a.actions || []).map((act, i) => {
                  const setAct = (changes: Partial<Action>) => {
                    const next = [...a.actions];
                    next[i] = { ...act, ...changes };
                    patch(a.id, { actions: next });
                  };
                  return (
                    <div key={i} className="border rounded-md p-2 space-y-2">
                      <div className="flex gap-2">
                        <Select value={act.type} onValueChange={(v) => setAct({ type: v as Action["type"] })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="set_field">Set a field on the job</SelectItem>
                            <SelectItem value="send_email">Send an email</SelectItem>
                            <SelectItem value="send_sms">Send an SMS</SelectItem>
                            <SelectItem value="create_alert">Create an in-app alert</SelectItem>
                            <SelectItem value="run_report">Run a report automation</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => patch(a.id, { actions: a.actions.filter((_, x) => x !== i) })}
                        >
                          Remove
                        </Button>
                      </div>

                      {act.type === "set_field" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={act.field || ""} onValueChange={(v) => setAct({ field: v })}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Field" /></SelectTrigger>
                            <SelectContent>
                              {JOB_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-9"
                            placeholder="value (true / false for checkboxes)"
                            value={act.value || ""}
                            onChange={(e) => setAct({ value: e.target.value })}
                          />
                        </div>
                      )}

                      {(act.type === "send_email" || act.type === "send_sms") && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={act.to || "marketer"} onValueChange={(v) => setAct({ to: v as any })}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="marketer">Marketer</SelectItem>
                                <SelectItem value="tech">Technician</SelectItem>
                                <SelectItem value="client">Client</SelectItem>
                                <SelectItem value="custom">Specific address / number</SelectItem>
                              </SelectContent>
                            </Select>
                            {act.to === "custom" && (
                              <Input
                                className="h-9"
                                placeholder={act.type === "send_email" ? "email@example.com" : "+15551234567"}
                                value={act.address || ""}
                                onChange={(e) => setAct({ address: e.target.value })}
                              />
                            )}
                          </div>
                          {act.type === "send_email" && (
                            <Input
                              className="h-9"
                              placeholder="Subject"
                              value={act.subject || ""}
                              onChange={(e) => setAct({ subject: e.target.value })}
                            />
                          )}
                          <Textarea
                            rows={3}
                            placeholder="Message — use {{address}}, {{price}}, {{status}}, {{tech_name}}…"
                            value={act.body || ""}
                            onChange={(e) => setAct({ body: e.target.value })}
                          />
                        </div>
                      )}

                      {act.type === "create_alert" && (
                        <div className="space-y-2">
                          <Input
                            className="h-9"
                            placeholder="Alert title"
                            value={act.subject || ""}
                            onChange={(e) => setAct({ subject: e.target.value })}
                          />
                          <Textarea
                            rows={2}
                            placeholder="Alert details — supports {{field}} tokens"
                            value={act.body || ""}
                            onChange={(e) => setAct({ body: e.target.value })}
                          />
                        </div>
                      )}

                      {act.type === "run_report" && (
                        <Select
                          value={act.reportAutomationId || ""}
                          onValueChange={(v) => setAct({ reportAutomationId: v })}
                        >
                          <SelectTrigger className="h-9"><SelectValue placeholder="Choose a report automation" /></SelectTrigger>
                          <SelectContent>
                            {reports.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patch(a.id, { actions: [...(a.actions || []), { type: "create_alert", subject: a.name }] })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add action
                  </Button>
                  <Button size="sm" onClick={() => save(a)}>Save</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Recent runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has fired yet.</p>
          ) : (
            <div className="border rounded-md divide-y max-h-80 overflow-auto">
              {runs.map((r) => (
                <div key={r.id} className="p-2 text-xs flex gap-2">
                  <span className="text-muted-foreground w-36 shrink-0">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  <span className="font-medium w-40 shrink-0 truncate">{r.automation_name}</span>
                  <span className={r.status === "error" ? "text-destructive" : ""}>{r.status}</span>
                  <span className="text-muted-foreground truncate">{r.detail}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
