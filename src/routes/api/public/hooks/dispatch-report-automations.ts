import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  computeReportData,
  renderReportHtml,
  type ReportSpec,
} from "@/lib/reportSpec";
import type { PartsCharge } from "@/lib/partsCharges";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

const SENDER_DOMAIN = "notify.gedatajob.com";
const FROM_ADDRESS = `Reports <reports@${SENDER_DOMAIN}>`;

type Schedule = {
  freq?: "daily" | "weekly" | "monthly";
  weekday?: number; // 0=Sun..6=Sat
  monthDay?: number; // 1..31
  time?: string; // "HH:MM"
  tz?: string; // IANA timezone; falls back to UTC
};

type Recipients = {
  roles?: string[];
  marketers?: string[];
  emails?: string[];
  perMarketer?: boolean;
  sendToMarketer?: boolean;
};

type Automation = {
  id: string;
  name: string;
  enabled: boolean;
  template: ReportSpec;
  schedule: Schedule;
  recipients: Recipients;
  last_run_at: string | null;
};

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

// Wall-clock parts of `now` as seen in the given IANA timezone.
function tzParts(now: Date, tz: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC", hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short",
    }).formatToParts(now);
  }
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  const hour = p.hour === "24" ? 0 : parseInt(p.hour, 10);
  return {
    year: parseInt(p.year, 10),
    month: parseInt(p.month, 10),
    day: parseInt(p.day, 10),
    hour,
    minute: parseInt(p.minute, 10),
    weekday: WEEKDAY_MAP[p.weekday] ?? 0,
    dateKey: `${p.year}-${p.month}-${p.day}`,
  };
}

// A Date whose UTC calendar equals the timezone's local calendar date (noon),
// so resolveSpecRange (which runs in the UTC Worker) computes the right window.
function tzToday(now: Date, tz: string): Date {
  const p = tzParts(now, tz);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0));
}

// Returns true when the automation's scheduled occurrence has passed for the
// current local day and it has not already run that local day. Evaluated in the
// automation's own timezone (falls back to UTC).
function isDue(a: Automation, now: Date): boolean {
  const sched = a.schedule || {};
  const freq = sched.freq || "weekly";
  const tz = sched.tz || "UTC";
  const [hh, mm] = (sched.time || "08:00").split(":").map((n) => parseInt(n, 10));
  const p = tzParts(now, tz);
  if (p.hour * 60 + p.minute < (hh || 0) * 60 + (mm || 0)) return false;
  if (freq === "weekly" && p.weekday !== (sched.weekday ?? 1)) return false;
  if (freq === "monthly" && p.day !== (sched.monthDay ?? 1)) return false;
  if (a.last_run_at) {
    const lp = tzParts(new Date(a.last_run_at), tz);
    if (lp.dateKey === p.dateKey) return false; // already ran today (local)
  }
  return true;
}

async function resolveRoleEmails(admin: any, roles: string[]): Promise<string[]> {
  if (!roles.length) return [];
  const { data: roleRows } = await admin.from("user_roles").select("user_id, role").in("role", roles);
  const ids = [...new Set((roleRows || []).map((r: any) => r.user_id))];
  if (!ids.length) return [];
  const { data: profs } = await admin.from("profiles").select("email").in("id", ids);
  return (profs || []).map((p: any) => p.email).filter(Boolean);
}

async function resolveMarketerEmails(admin: any, names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!names.length) return map;
  const { data } = await admin.from("companies").select("company_name, email").in("company_name", names);
  for (const c of data || []) {
    if (c.email) map.set(c.company_name, c.email);
  }
  return map;
}

async function sendEmail(admin: any, to: string, subject: string, html: string, autoId: string) {
  await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to,
      from: FROM_ADDRESS,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      label: "scheduled_report",
      purpose: "transactional",
      queued_at: new Date().toISOString(),
      message_id: `report-${autoId}-${to}-${Date.now()}`,
    },
  });
}

export const Route = createFileRoute("/api/public/hooks/dispatch-report-automations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("x-apikey");
        const expectedKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!apikey || !expectedKey || apikey !== expectedKey) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = process.env.SUPABASE_URL!;
        const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(url, service, { auth: { persistSession: false } });

        const { data: automations, error } = await admin
          .from("report_automations")
          .select("*")
          .eq("enabled", true);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const now = new Date();
        const due = (automations || []).filter((a: any) => isDue(a as Automation, now));
        if (!due.length) return Response.json({ processed: 0, sent: 0 });

        // Fetch all jobs once and reuse across automations.
        const { data: jobsData } = await admin.from("jobs").select("*");
        const jobs = (jobsData as Job[]) || [];

        let sent = 0;
        for (const raw of due) {
          const a = raw as Automation;
          const spec = a.template as ReportSpec;
          const rec = a.recipients || {};

          try {
            const localToday = tzToday(now, a.schedule?.tz || "UTC");
            if (rec.perMarketer) {
              // Build one report per marketer. Whether the marketer themselves
              // receives it is controlled by `sendToMarketer`; the chosen
              // recipients (roles + custom emails + specifically selected
              // marketers) always receive a copy of every marketer's report.
              const names = (spec.marketers && spec.marketers.length
                ? spec.marketers
                : [...new Set(jobs.map((j) => (j.company_1 || j.company || "").trim()).filter(Boolean))]) as string[];
              const marketerEmailMap = await resolveMarketerEmails(admin, names);

              // Recipients that get a copy of each per-marketer report.
              const chosen = new Set<string>();
              for (const e of rec.emails || []) if (e) chosen.add(e);
              for (const e of await resolveRoleEmails(admin, rec.roles || [])) chosen.add(e);
              const selectedMarketerEmails = await resolveMarketerEmails(admin, rec.marketers || []);
              for (const e of selectedMarketerEmails.values()) chosen.add(e);

              for (const name of names) {
                const perSpec: ReportSpec = { ...spec, marketers: [name] };
                const data = computeReportData(jobs, perSpec, localToday);
                const html = renderReportHtml(data, perSpec);

                const recipients = new Set<string>(chosen);
                if (rec.sendToMarketer) {
                  const own = marketerEmailMap.get(name);
                  if (own) recipients.add(own);
                }
                for (const to of recipients) {
                  await sendEmail(admin, to, `${spec.title || "Report"} — ${name}`, html, a.id);
                  sent++;
                }
              }
            } else {
              const data = computeReportData(jobs, spec, localToday);
              const html = renderReportHtml(data, spec);
              const recipients = new Set<string>();
              for (const e of rec.emails || []) if (e) recipients.add(e);
              for (const e of await resolveRoleEmails(admin, rec.roles || [])) recipients.add(e);
              const marketerEmails = await resolveMarketerEmails(admin, rec.marketers || []);
              for (const e of marketerEmails.values()) recipients.add(e);
              for (const to of recipients) {
                await sendEmail(admin, to, spec.title || "Scheduled Report", html, a.id);
                sent++;
              }
            }
            await admin.from("report_automations").update({ last_run_at: now.toISOString() }).eq("id", a.id);
          } catch (e: any) {
            // Skip this automation but keep going with the rest.
            console.error("report automation failed", a.id, String(e?.message || e));
          }
        }

        return Response.json({ processed: due.length, sent });
      },
    },
  },
});
