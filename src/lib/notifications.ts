// Helpers for in-app + email + SMS reminder display.
// Server-side sending happens in src/routes/api/public/hooks/dispatch-job-reminders.ts.
import type { Tables } from "@/integrations/supabase/types";

export type Job = Tables<"jobs"> & {
  job_time?: string | null;
  job_time_end?: string | null;
  notify_enabled?: boolean | null;
  notify_channels?: string[] | null;
  notify_lead_minutes?: number | null;
  notify_lead_minutes_list?: number[] | null;
  notified_lead_minutes?: number[] | null;
  notified_at?: string | null;
};

export type NotifyChannel =
  | "in_app"
  | "email_tech"
  | "email_client";

export const CHANNEL_LABELS: Record<NotifyChannel, string> = {
  in_app: "In-app reminder",
  email_tech: "Email technician",
  email_client: "Email client",
};

export const LEAD_PRESETS = [
  { minutes: 15, label: "15 min before" },
  { minutes: 30, label: "30 min before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 120, label: "2 hours before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 2880, label: "2 days before" },
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
