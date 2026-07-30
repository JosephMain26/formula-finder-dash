import { supabase } from "@/integrations/supabase/client";
import type { Automation } from "@/lib/automationEngine";

export type { Automation } from "@/lib/automationEngine";

export async function loadAutomations(): Promise<Automation[]> {
  const { data, error } = await (supabase as any)
    .from("automations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Automation[];
}

export async function upsertAutomation(a: Partial<Automation> & { name: string }) {
  const payload: any = {
    name: a.name,
    enabled: a.enabled ?? true,
    trigger: a.trigger ?? {},
    conditions: a.conditions ?? [],
    actions: a.actions ?? [],
  };
  if (a.id) payload.id = a.id;
  const { data, error } = await (supabase as any)
    .from("automations")
    .upsert(payload)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Automation;
}

export async function deleteAutomation(id: string) {
  const { error } = await (supabase as any).from("automations").delete().eq("id", id);
  if (error) throw error;
}

export type AutomationRun = {
  id: string;
  automation_id: string | null;
  automation_name: string | null;
  job_id: string | null;
  status: string;
  detail: string | null;
  created_at: string;
};

export async function loadAutomationRuns(limit = 50): Promise<AutomationRun[]> {
  const { data } = await (supabase as any)
    .from("automation_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []) as AutomationRun[];
}

export type AppAlert = {
  id: string;
  title: string;
  body: string | null;
  job_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function loadAlerts(limit = 30): Promise<AppAlert[]> {
  const { data } = await (supabase as any)
    .from("app_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []) as AppAlert[];
}

export async function markAlertRead(id: string) {
  await (supabase as any).from("app_alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function markAllAlertsRead() {
  await (supabase as any)
    .from("app_alerts")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
}
