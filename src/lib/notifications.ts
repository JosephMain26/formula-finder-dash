// Helpers for in-app + email + SMS reminder display.
// Server-side sending happens in src/routes/api/public/hooks/dispatch-job-reminders.ts.
import type { Tables } from "@/integrations/supabase/types";

export type Job = Tables<"jobs"> & {
  job_time?: string | null;
  notify_enabled?: boolean | null;
  notify_channels?: string[] | null;
  notify_lead_minutes?: number | null;
  notified_at?: string | null;
};

export type NotifyChannel =
  | "in_app"
  | "email_tech"
  | "email_client"
  | "sms_tech"
  | "sms_client";

export const CHANNEL_LABELS: Record<NotifyChannel, string> = {
  in_app: "In-app reminder",
  email_tech: "Email technician",
  email_client: "Email client",
  sms_tech: "SMS technician",
  sms_client: "SMS client",
};

export const LEAD_PRESETS = [
  { minutes: 15, label: "15 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 180, label: "3 hours before" },
  { minutes: 1440, label: "1 day before" },
];

export function jobDateTime(job: Pick<Job, "job_date" | "job_time">): Date | null {
  if (!job.job_date) return null;
  const time = job.job_time ?? "09:00:00";
  const dt = new Date(`${job.job_date}T${time}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function dueWithinLead(job: Job, nowMs = Date.now()): boolean {
  if (!job.notify_enabled) return false;
  const dt = jobDateTime(job);
  if (!dt) return false;
  const lead = (job.notify_lead_minutes ?? 60) * 60_000;
  const diff = dt.getTime() - nowMs;
  return diff > 0 && diff <= lead;
}
