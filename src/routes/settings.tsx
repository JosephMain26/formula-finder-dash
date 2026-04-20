import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  loadPaymentMethods,
  savePaymentMethods,
  newPaymentMethod,
  loadTemplates,
  saveTemplates,
  type PaymentMethod,
  type TemplatesSetting,
} from "@/lib/settings";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings - Jobs Dashboard" },
      { name: "description", content: "Configure payment methods and templates" },
    ],
  }),
});

function SettingsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [templates, setTemplates] = useState<TemplatesSetting>({ dashboardViews: [], exportTemplates: [] });
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [m, t] = await Promise.all([loadPaymentMethods(), loadTemplates()]);
      setMethods(m);
      setTemplates(t);
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
  function addMethod() {
    setMethods((prev) => [...prev, newPaymentMethod("")]);
  }
  function removeMethod(id: string) {
    setMethods((prev) => prev.filter((m) => m.id !== id));
  }
  async function savePayments() {
    const cleaned = methods
      .map((m) => ({ ...m, name: m.name.trim() }))
      .filter((m) => m.name.length > 0);
    setMethods(cleaned);
    await savePaymentMethods(cleaned);
    flash("Payment methods saved ✓");
  }

  // ----- Templates -----
  async function deleteDashboardView(id: string) {
    const next = { ...templates, dashboardViews: templates.dashboardViews.filter((v) => v.id !== id) };
    setTemplates(next);
    await saveTemplates(next);
    flash("Template deleted ✓");
  }
  async function deleteExportTemplate(id: string) {
    const next = { ...templates, exportTemplates: templates.exportTemplates.filter((v) => v.id !== id) };
    setTemplates(next);
    await saveTemplates(next);
    flash("Template deleted ✓");
  }
  async function renameDashboardView(id: string, name: string) {
    const next = { ...templates, dashboardViews: templates.dashboardViews.map((v) => (v.id === id ? { ...v, name } : v)) };
    setTemplates(next);
    await saveTemplates(next);
  }
  async function renameExportTemplate(id: string, name: string) {
    const next = { ...templates, exportTemplates: templates.exportTemplates.map((v) => (v.id === id ? { ...v, name } : v)) };
    setTemplates(next);
    await saveTemplates(next);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Configure application preferences</p>
            </div>
          </div>
          {savedAt && <span className="text-sm text-muted-foreground">{savedAt}</span>}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Tabs defaultValue="payment">
          <TabsList>
            <TabsTrigger value="payment">Payment Methods</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          {/* PAYMENT METHODS */}
          <TabsContent value="payment" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
              </CardHeader>
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
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={m.feePercent ?? ""}
                              onChange={(e) =>
                                updateMethod(m.id, {
                                  feePercent: e.target.value === "" ? undefined : parseFloat(e.target.value),
                                })
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
              <CardHeader>
                <CardTitle>Dashboard View Templates</CardTitle>
              </CardHeader>
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
              <CardHeader>
                <CardTitle>PDF Export Templates</CardTitle>
              </CardHeader>
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
        </Tabs>
      </main>
    </div>
  );
}
