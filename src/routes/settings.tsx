import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Building2, Wrench, Brain, Users, User, FormInput, MessageSquare } from "lucide-react";
import { JobFormBuilder } from "@/components/settings/JobFormBuilder";
import { MessageTemplatesManager } from "@/components/settings/MessageTemplatesManager";
import { StatusesManager } from "@/components/settings/StatusesManager";
import { TypeGroupsManager } from "@/components/settings/TypeGroupsManager";
import { InstallationCatalogManager } from "@/components/settings/InstallationCatalogManager";
import { DoorCentersManager } from "@/components/settings/DoorCentersManager";
import { RemoteLinkButton } from "@/components/RemoteLinkButton";
import { UsersManager } from "@/components/UsersManager";
import { MyProfileCard } from "@/components/MyProfileCard";
import { MobileNav } from "@/components/MobileNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import {
  loadPaymentMethods,
  savePaymentMethods,
  newPaymentMethod,
  loadTemplates,
  saveTemplates,
  type PaymentMethod,
  type TemplatesSetting,
} from "@/lib/settings";
import {
  loadAITraining,
  saveAITraining,
  newMarketerRule,
  emptyTraining,
  type AITrainingSetting,
} from "@/lib/aiTraining";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings - Jobs Dashboard" },
      { name: "description", content: "Configure payment methods, templates, and AI training" },
    ],
  }),
});

function SettingsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [templates, setTemplates] = useState<TemplatesSetting>({ dashboardViews: [], exportTemplates: [] });
  const [training, setTraining] = useState<AITrainingSetting>(emptyTraining);
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate({ to: "/" });
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    (async () => {
      const [m, t, ai, c] = await Promise.all([
        loadPaymentMethods(),
        loadTemplates(),
        loadAITraining(),
        supabase.from("companies").select("company_name").order("company_name"),
      ]);
      setMethods(m);
      setTemplates(t);
      setTraining(ai);
      setCompanyNames(((c.data as { company_name: string }[]) || []).map((r) => r.company_name).filter(Boolean));
      setLoading(false);
    })();
  }, []);

  function flash(msg: string) {
    setSavedAt(msg);
    setTimeout(() => setSavedAt(null), 1800);
  }

  // ----- Payment methods -----
  function updateMethod(id: string, patch: Partial<PaymentMethod>) {
    setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function addMethod() { setMethods((prev) => [...prev, newPaymentMethod("")]); }
  function removeMethod(id: string) { setMethods((prev) => prev.filter((m) => m.id !== id)); }
  async function savePayments() {
    const cleaned = methods.map((m) => ({ ...m, name: m.name.trim() })).filter((m) => m.name.length > 0);
    setMethods(cleaned);
    await savePaymentMethods(cleaned);
    flash("Payment methods saved ✓");
  }

  // ----- Templates -----
  async function deleteDashboardView(id: string) {
    const next = { ...templates, dashboardViews: templates.dashboardViews.filter((v) => v.id !== id) };
    setTemplates(next); await saveTemplates(next); flash("Template deleted ✓");
  }
  async function deleteExportTemplate(id: string) {
    const next = { ...templates, exportTemplates: templates.exportTemplates.filter((v) => v.id !== id) };
    setTemplates(next); await saveTemplates(next); flash("Template deleted ✓");
  }
  async function renameDashboardView(id: string, name: string) {
    const next = { ...templates, dashboardViews: templates.dashboardViews.map((v) => (v.id === id ? { ...v, name } : v)) };
    setTemplates(next); await saveTemplates(next);
  }
  async function renameExportTemplate(id: string, name: string) {
    const next = { ...templates, exportTemplates: templates.exportTemplates.map((v) => (v.id === id ? { ...v, name } : v)) };
    setTemplates(next); await saveTemplates(next);
  }

  // ----- AI Training -----
  function addRule() { setTraining((p) => ({ ...p, marketerRules: [...p.marketerRules, newMarketerRule()] })); }
  function updateRule(id: string, patch: Partial<{ marketerName: string; patternsText: string }>) {
    setTraining((p) => ({
      ...p,
      marketerRules: p.marketerRules.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r };
        if (patch.marketerName !== undefined) next.marketerName = patch.marketerName;
        if (patch.patternsText !== undefined) {
          next.patterns = patch.patternsText.split(",").map((s) => s.trim()).filter(Boolean);
        }
        return next;
      }),
    }));
  }
  function removeRule(id: string) {
    setTraining((p) => ({ ...p, marketerRules: p.marketerRules.filter((r) => r.id !== id) }));
  }
  function clearCorrections() {
    setTraining((p) => ({ ...p, corrections: [] }));
  }
  async function saveTraining() {
    const cleaned: AITrainingSetting = {
      ...training,
      marketerRules: training.marketerRules
        .map((r) => ({ ...r, marketerName: r.marketerName.trim() }))
        .filter((r) => r.marketerName && r.patterns.length > 0),
    };
    setTraining(cleaned);
    await saveAITraining(cleaned);
    toast.success("AI training saved");
    flash("AI training saved ✓");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3 sm:py-5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MobileNav className="lg:hidden" />
            <Link to="/" className="hidden lg:inline-flex">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">Settings</h1>
              <p className="hidden sm:block text-sm text-muted-foreground mt-0.5">Configure application preferences</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 flex-wrap justify-end">
            {savedAt && <span className="text-sm text-muted-foreground mr-2">{savedAt}</span>}
            <Link to="/companies">
              <Button variant="outline" size="sm"><Building2 className="h-4 w-4 mr-2" /> Marketers</Button>
            </Link>
            <Link to="/technicians">
              <Button variant="outline" size="sm"><Wrench className="h-4 w-4 mr-2" /> Technicians</Button>
            </Link>
            <Link to="/installers">
              <Button variant="outline" size="sm"><Wrench className="h-4 w-4 mr-2" /> Installers</Button>
            </Link>
            <Link to="/clients">
              <Button variant="outline" size="sm"><Users className="h-4 w-4 mr-2" /> Clients</Button>
            </Link>
            <RemoteLinkButton />
          </div>
          <div className="md:hidden">
            <RemoteLinkButton />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Tabs defaultValue="profile">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="w-max">
              <TabsTrigger value="profile"><User className="h-4 w-4 mr-1" /> My Profile</TabsTrigger>
              <TabsTrigger value="form"><FormInput className="h-4 w-4 mr-1" /> Job Form & Statuses</TabsTrigger>
              <TabsTrigger value="types">Job & Comp Types</TabsTrigger>
              <TabsTrigger value="payment">Payment Methods</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="messages"><MessageSquare className="h-4 w-4 mr-1" /> Message Templates</TabsTrigger>
              <TabsTrigger value="ai"><Brain className="h-4 w-4 mr-1" /> AI Training</TabsTrigger>
              <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" /> Users</TabsTrigger>
            </TabsList>
          </div>

          {/* PAYMENT METHODS */}
          {/* MY PROFILE */}
          <TabsContent value="profile" className="mt-4">
            <MyProfileCard />
          </TabsContent>

          {/* JOB FORM & STATUSES */}
          <TabsContent value="form" className="mt-4 space-y-6">
            <StatusesManager />
            <JobFormBuilder />
          </TabsContent>

          <TabsContent value="types" className="mt-4">
            <TypeGroupsManager />
          </TabsContent>

          <TabsContent value="payment" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {methods.length === 0 && (
                        <p className="text-sm text-muted-foreground">No payment methods yet — add your first one below.</p>
                      )}
                      {methods.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 border rounded-md p-2">
                          <Input
                            placeholder="Method name (e.g. Zelle)"
                            value={m.name}
                            onChange={(e) => updateMethod(m.id, { name: e.target.value })}
                            className="flex-1 h-9"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Fee %</span>
                            <Input
                              type="number" step="0.01" min="0" max="100" placeholder="0"
                              value={m.feePercent ?? ""}
                              onChange={(e) =>
                                updateMethod(m.id, { feePercent: e.target.value === "" ? undefined : parseFloat(e.target.value) })
                              }
                              className="w-20 h-9"
                            />
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeMethod(m.id)} className="h-9 w-9">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <Button variant="outline" size="sm" onClick={addMethod}>
                        <Plus className="h-4 w-4 mr-2" /> Add method
                      </Button>
                      <Button onClick={savePayments}>Save Changes</Button>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Set a Fee % for any method (e.g. Credit Card 3%) — it will auto-fill the CC Fee field when that method is selected on a job.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TEMPLATES */}
          <TabsContent value="templates" className="mt-4 space-y-6">
            <Card>
              <CardHeader><CardTitle>Dashboard View Templates</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : templates.dashboardViews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No saved views. Open the dashboard, choose your columns, then click <em>Save view as template</em>.
                  </p>
                ) : (
                  templates.dashboardViews.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 border rounded-md p-2">
                      <Input
                        value={v.name}
                        onChange={(e) =>
                          setTemplates((prev) => ({
                            ...prev,
                            dashboardViews: prev.dashboardViews.map((d) => (d.id === v.id ? { ...d, name: e.target.value } : d)),
                          }))
                        }
                        onBlur={(e) => renameDashboardView(v.id, e.target.value)}
                        className="flex-1 h-9"
                      />
                      <span className="text-xs text-muted-foreground">{v.visibleColumns.length} columns</span>
                      <Button variant="ghost" size="icon" onClick={() => deleteDashboardView(v.id)} className="h-9 w-9">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>PDF Export Templates</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : templates.exportTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No saved export templates. Open <em>Export PDF</em>, configure fields/sections, then save it as a template.
                  </p>
                ) : (
                  templates.exportTemplates.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 border rounded-md p-2">
                      <Input
                        value={t.name}
                        onChange={(e) =>
                          setTemplates((prev) => ({
                            ...prev,
                            exportTemplates: prev.exportTemplates.map((d) => (d.id === t.id ? { ...d, name: e.target.value } : d)),
                          }))
                        }
                        onBlur={(e) => renameExportTemplate(t.id, e.target.value)}
                        className="flex-1 h-9"
                      />
                      <span className="text-xs text-muted-foreground">
                        {t.columns.length} fields · {t.sections.filter((s) => s.enabled).length} sections
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => deleteExportTemplate(t.id)} className="h-9 w-9">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MESSAGE TEMPLATES */}
          <TabsContent value="messages" className="mt-4">
            <MessageTemplatesManager />
          </TabsContent>

          {/* AI TRAINING */}
          <TabsContent value="ai" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Marketer Mapping Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  When a parsed message mentions any of the listed names/keywords (case-insensitive),
                  the marketer will be set automatically. Separate keywords with commas.
                </p>
                {training.marketerRules.length === 0 && (
                  <p className="text-sm text-muted-foreground">No rules yet — add your first one below.</p>
                )}
                {training.marketerRules.map((r) => (
                  <div key={r.id} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:items-center border rounded-md p-2">
                    <div className="sm:col-span-4">
                      <Select
                        value={r.marketerName || ""}
                        onValueChange={(v) => updateRule(r.id, { marketerName: v })}
                        disabled={companyNames.length === 0}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={companyNames.length === 0 ? "No marketers — add some first" : "Select marketer"} />
                        </SelectTrigger>
                        <SelectContent>
                          {companyNames.map((name) => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                          {r.marketerName && !companyNames.includes(r.marketerName) && (
                            <SelectItem value={r.marketerName}>{r.marketerName} (missing)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="sm:col-span-7 h-9"
                      placeholder="Keywords / company names that map to this marketer (comma separated)"
                      value={r.patterns.join(", ")}
                      onChange={(e) => updateRule(r.id, { patternsText: e.target.value })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeRule(r.id)} className="h-9 w-9 sm:col-span-1 self-end sm:self-auto">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={addRule}>
                    <Plus className="h-4 w-4 mr-2" /> Add rule
                  </Button>
                  <Button size="sm" onClick={saveTraining}>Save</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>General AI Rules / Memory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Free-form instructions the AI will always follow when parsing messages
                  (e.g. "If the message contains 'urgent', set notes to start with URGENT", or
                  "Phone numbers without + are US numbers").
                </p>
                <Textarea
                  rows={6}
                  value={training.generalRules}
                  onChange={(e) => setTraining((p) => ({ ...p, generalRules: e.target.value }))}
                  placeholder="Write any rules the AI should remember..."
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveTraining}>Save</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Corrections (auto-learned)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Every time you fix a parsed value before submitting, it's recorded here and sent
                  to the AI as additional context next time.
                </p>
                {training.corrections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No corrections recorded yet.</p>
                ) : (
                  <div className="border rounded-md divide-y max-h-80 overflow-auto">
                    {training.corrections.map((c) => (
                      <div key={c.id} className="p-2 text-xs flex items-center gap-2">
                        <span className="text-muted-foreground w-32 shrink-0">
                          {new Date(c.at).toLocaleString()}
                        </span>
                        <span className="font-medium w-20 shrink-0">{c.field}</span>
                        <span className="line-through text-muted-foreground truncate">{c.parsed || "—"}</span>
                        <span>→</span>
                        <span className="font-semibold truncate">{c.corrected}</span>
                      </div>
                    ))}
                  </div>
                )}
                {training.corrections.length > 0 && (
                  <div className="flex justify-end pt-1">
                    <Button variant="outline" size="sm" onClick={async () => { clearCorrections(); await saveAITraining({ ...training, corrections: [] }); toast.success("Cleared"); }}>
                      Clear history
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users" className="mt-4">
            <UsersManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
