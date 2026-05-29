import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  computeReportData,
  renderReportHtml,
  type ReportSpec,
} from "@/lib/reportSpec";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

const SENDER_DOMAIN = "notify.gedatajob.com";
const FROM_ADDRESS = `Reports <reports@${SENDER_DOMAIN}>`;

type Schedule = {
  freq?: "daily" | "weekly" | "monthly";
  weekday?: number; // 0=Sun..6=Sat
  monthDay?: number; // 1..31
  time?: string; // "HH:MM"
};

type Recipients = {
  roles?: string[];
  marketers?: string[];
  emails?: string[];
  perMarketer?: boolean;
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

// Returns true when the automation's scheduled occurrence has passed and it has
// not already run for that occurrence. Times are evaluated in the server (UTC).
function isDue(a: Automation, now: Date): boolean {
  const sched = a.schedule || {};
  const freq = sched.freq || "weekly";
  const [hh, mm] = (sched.time || "08:00").split(":").map((n) => parseInt(n, 10));
  const occ = new Date(now);
  occ.setHours(hh || 0, mm || 0, 0, 0);
  if (now < occ) return false;
  if (freq === "weekly" && now.getDay() !== (sched.weekday ?? 1)) return false;
  if (freq === "monthly" && now.getDate() !== (sched.monthDay ?? 1)) return false;
  if (a.last_run_at && new Date(a.last_run_at) >= occ) return false;
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
        if (!apikey || apikey !== process.env.SUPABASE_ANON_KEY) {
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
            if (rec.perMarketer) {
              // Each marketer gets a report filtered to just their jobs.
              const names = (spec.marketers && spec.marketers.length
                ? spec.marketers
                : [...new Set(jobs.map((j) => (j.company_1 || j.company || "").trim()).filter(Boolean))]) as string[];
              const emailMap = await resolveMarketerEmails(admin, names);
              for (const name of names) {
                const to = emailMap.get(name);
                if (!to) continue;
                const perSpec: ReportSpec = { ...spec, marketers: [name] };
                const data = computeReportData(jobs, perSpec, now);
                const html = renderReportHtml(data, perSpec);
                await sendEmail(admin, to, `${spec.title || "Report"} — ${name}`, html, a.id);
                sent++;
              }
            } else {
              const data = computeReportData(jobs, spec, now);
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
