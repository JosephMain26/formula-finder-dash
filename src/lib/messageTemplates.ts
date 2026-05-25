import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type RecipientType = "technician" | "marketer" | "installer" | "client" | "custom";
export type MessageChannel = "whatsapp" | "sms";

export type MessageTemplate = {
  id: string;
  name: string;
  recipient_type: RecipientType;
  channel_default: MessageChannel;
  body: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "client_name", label: "Client name" },
  { key: "address", label: "Job address" },
  { key: "phone", label: "Job phone" },
  { key: "job_date", label: "Job date" },
  { key: "job_time", label: "Job time" },
  { key: "job_type", label: "Job type" },
  { key: "comp_type", label: "Comp type" },
  { key: "price", label: "Price" },
  { key: "deposit_amount", label: "Deposit amount" },
  { key: "deposit_date", label: "Deposit date" },
  { key: "scheduled_completion_date", label: "Scheduled completion date" },
  { key: "completed_at_date", label: "Completion date" },
  { key: "tech_name", label: "Technician name" },
  { key: "installer_name", label: "Installer name" },
  { key: "marketer", label: "Marketer (company)" },
  { key: "po_number", label: "PO #" },
  { key: "notes", label: "Notes" },
  { key: "status", label: "Status" },
  { key: "install_types", label: "Installation types (comma-separated)" },
  { key: "install_models", label: "Installation models" },
  { key: "install_colors", label: "Installation colors" },
  { key: "install_items", label: "Installation items checklist" },
  { key: "install_count", label: "# of installations" },
  { key: "install_systems", label: "Installation systems (Extension/Torsion)" },
  { key: "install_sizes", label: "Installation sizes" },
  { key: "pickup_name", label: "Pickup location name" },
  { key: "pickup_address", label: "Pickup address" },
  { key: "pickup_phone", label: "Pickup phone" },
  { key: "pickup_link", label: "Pickup navigation link" },
];

type Job = Tables<"jobs"> & { extra_fields?: any };

export function buildJobVariables(job: Partial<Job> & Record<string, any>, extra?: { client_name?: string }) {
  const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString() : "");
  const fmtTime = (t: any) => (t ? String(t).slice(0, 5) : "");
  const money = (n: any) => (n != null && n !== "" ? `$${Number(n).toFixed(2)}` : "");
  return {
    client_name: extra?.client_name || "",
    address: job.address || "",
    phone: job.phone_no || "",
    job_date: fmtDate(job.job_date),
    job_time: fmtTime(job.job_time),
    job_type: job.job_type || "",
    comp_type: job.comp_type || "",
    price: money(job.price),
    deposit_amount: money((job as any).deposit_amount),
    deposit_date: fmtDate((job as any).deposit_date),
    scheduled_completion_date: fmtDate((job as any).scheduled_completion_date),
    completed_at_date: fmtDate((job as any).completed_at_date),
    tech_name: job.tech_name || "",
    installer_name: (job as any).installer_name || "",
    marketer: (job as any).company_1 || "",
    po_number: job.po_number || "",
    notes: job.notes || "",
    status: job.status || "",
  } as Record<string, string>;
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] ?? "" : ""
  );
}

export async function listTemplates(): Promise<MessageTemplate[]> {
  const { data } = await (supabase as any)
    .from("message_templates")
    .select("*")
    .order("name");
  return (data as MessageTemplate[]) || [];
}

export async function saveTemplate(t: Partial<MessageTemplate>): Promise<MessageTemplate | null> {
  if (t.id) {
    const { data, error } = await (supabase as any)
      .from("message_templates")
      .update({
        name: t.name,
        recipient_type: t.recipient_type,
        channel_default: t.channel_default,
        body: t.body,
        is_active: t.is_active ?? true,
      })
      .eq("id", t.id)
      .select()
      .single();
    if (error) throw error;
    return data as MessageTemplate;
  }
  const { data, error } = await (supabase as any)
    .from("message_templates")
    .insert({
      name: t.name,
      recipient_type: t.recipient_type,
      channel_default: t.channel_default,
      body: t.body,
      is_active: t.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MessageTemplate;
}

export async function deleteTemplate(id: string) {
  const { error } = await (supabase as any).from("message_templates").delete().eq("id", id);
  if (error) throw error;
}

export function buildWhatsAppLink(phone: string, body: string): string {
  const digits = (phone || "").replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

export async function logMessageSend(input: {
  job_id?: string | null;
  template_id?: string | null;
  recipient_type?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  channel: MessageChannel;
  body_rendered: string;
  status?: string;
  error?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  await (supabase as any).from("message_send_log").insert({
    ...input,
    sent_by: u.user?.id || null,
  });
}
