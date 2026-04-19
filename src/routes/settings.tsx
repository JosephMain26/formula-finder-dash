import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings - Jobs Dashboard" },
      { name: "description", content: "Configure payment options and other application settings" },
    ],
  }),
});

const PAYMENT_OPTIONS = ["Zelle", "Check", "Venmo", "CashApp", "PayPal", "ACH", "Credit Card"] as const;
type PaymentSettings = {
  enabled: string[];
  ccFeePercent: number;
};

const DEFAULT_SETTINGS: PaymentSettings = { enabled: [], ccFeePercent: 0 };

function SettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("value")
        .eq("key", "payment_options")
        .maybeSingle();
      if (data?.value) {
        const v = data.value as Partial<PaymentSettings>;
        setSettings({
          enabled: Array.isArray(v.enabled) ? v.enabled : [],
          ccFeePercent: typeof v.ccFeePercent === "number" ? v.ccFeePercent : 0,
        });
      }
      setLoading(false);
    })();
  }, []);

  function toggle(option: string, checked: boolean) {
    setSettings((prev) => ({
      ...prev,
      enabled: checked
        ? [...prev.enabled, option]
        : prev.enabled.filter((o) => o !== option),
    }));
  }

  async function save() {
    setSaving(true);
    await supabase
      .from("app_settings" as any)
      .upsert({ key: "payment_options", value: settings as any, updated_at: new Date().toISOString() });
    setSaving(false);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
  }

  const ccEnabled = settings.enabled.includes("Credit Card");

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
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Tabs defaultValue="payment">
          <TabsList>
            <TabsTrigger value="payment">Payment Options</TabsTrigger>
          </TabsList>

          <TabsContent value="payment" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <>
                    {PAYMENT_OPTIONS.map((option) => (
                      <div key={option} className="flex items-center gap-3">
                        <Checkbox
                          id={`pay-${option}`}
                          checked={settings.enabled.includes(option)}
                          onCheckedChange={(v) => toggle(option, !!v)}
                        />
                        <label htmlFor={`pay-${option}`} className="text-sm cursor-pointer flex-1">
                          {option}
                        </label>
                        {option === "Credit Card" && ccEnabled && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Processing fee (%)</label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="w-24 h-8"
                              value={settings.ccFeePercent}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  ccFeePercent: parseFloat(e.target.value) || 0,
                                }))
                              }
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-3 pt-3">
                      <Button onClick={save} disabled={saving}>
                        {saving ? "Saving…" : "Save Changes"}
                      </Button>
                      {savedAt && <span className="text-sm text-muted-foreground">Saved ✓</span>}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
