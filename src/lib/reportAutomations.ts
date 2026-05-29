import { supabase } from "@/integrations/supabase/client";
import type { ReportSpec } from "@/lib/reportSpec";

export type AutomationFreq = "daily" | "weekly" | "monthly";

export type AutomationSchedule = {
  freq: AutomationFreq;
  weekday?: number; // 0=Sun..6=Sat (weekly)
  monthDay?: number; // 1..31 (monthly)
  time: string; // "HH:MM"
};

export type AutomationRecipients = {
  roles: string[];
  marketers: string[];
  emails: string[];
  perMarketer: boolean;
};

export type ReportAutomation = {
  id: string;
  name: string;
  enabled: boolean;
  template: ReportSpec;
  schedule: AutomationSchedule;
  recipients: AutomationRecipients;
  last_run_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function loadAutomations(): Promise<ReportAutomation[]> {
  const { data, error } = await (supabase as any)
    .from("report_automations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ReportAutomation[];
}

export async function upsertAutomation(a: Partial<ReportAutomation> & { name: string }) {
  const payload: any = {
    name: a.name,
    enabled: a.enabled ?? true,
    template: a.template ?? {},
    schedule: a.schedule ?? {},
    recipients: a.recipients ?? {},
  };
  if (a.id) payload.id = a.id;
  const { data, error } = await (supabase as any)
    .from("report_automations")
    .upsert(payload)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as ReportAutomation;
}

export async function deleteAutomation(id: string) {
  const { error } = await (supabase as any).from("report_automations").delete().eq("id", id);
  if (error) throw error;
}
