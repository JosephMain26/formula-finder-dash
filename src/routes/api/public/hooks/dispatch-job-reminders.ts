import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SENDER_DOMAIN = "notify.gedatajob.com";
const FROM_ADDRESS = `Reminders <reminders@${SENDER_DOMAIN}>`;

// Dispatcher route called by pg_cron every few minutes. Finds jobs whose
// scheduled time is within their lead window, sends configured reminders,
// and marks them notified.
export const Route = createFileRoute("/api/public/hooks/dispatch-job-reminders")({
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

        const nowMs = Date.now();
        const horizonMs = nowMs + 24 * 60 * 60 * 1000; // look ahead 24h max
        const todayIso = new Date(nowMs).toISOString().slice(0, 10);
        const horizonIso = new Date(horizonMs).toISOString().slice(0, 10);

        const { data: jobs, error } = await admin
          .from("jobs")
          .select("*")
          .eq("notify_enabled", true)
          .not("job_date", "is", null)
          .gte("job_date", todayIso)
          .lte("job_date", horizonIso);

        if (error) return Response.json({ error: error.message }, { status: 500 });

        let sent = 0;
        for (const job of jobs || []) {
          const time = (job as any).job_time || "09:00:00";
          const dt = new Date(`${(job as any).job_date}T${time}`);
          if (Number.isNaN(dt.getTime())) continue;
          const diff = dt.getTime() - nowMs;
          if (diff <= 0) continue;

          const leadsRaw = (job as any).notify_lead_minutes_list as number[] | null;
          const leads: number[] = (leadsRaw && leadsRaw.length > 0)
            ? leadsRaw
            : [(job as any).notify_lead_minutes ?? 60];
          const alreadySent: number[] = (job as any).notified_lead_minutes || [];

          // Find leads whose window has opened (diff <= lead) and that haven't been sent yet.
          const due = leads.filter((m) => diff <= m * 60_000 && !alreadySent.includes(m));
          if (due.length === 0) continue;

          const channels: string[] = (job as any).notify_channels || [];
          const summary = `${(job as any).job_type || "Job"} for ${(job as any).company || (job as any).company_1 || "client"} at ${(job as any).address || "TBD"} on ${(job as any).job_date} ${time.slice(0, 5)}`;

          for (const leadMin of due) {
            const subject = `Reminder (${leadMin < 60 ? `${leadMin}m` : leadMin < 1440 ? `${Math.round(leadMin / 60)}h` : `${Math.round(leadMin / 1440)}d`} before): ${(job as any).job_type || "Job"} at ${time.slice(0, 5)}`;
            const html = `<p>${summary}</p><p>Tech: ${(job as any).tech_name || "—"}</p>`;

            for (const ch of channels) {
              try {
                if (ch === "email_tech" || ch === "email_client") {
                  const recipient = await resolveEmail(admin, job, ch);
                  if (!recipient) {
                    await admin.from("notification_log").insert({ job_id: (job as any).id, channel: ch, status: "skipped", error: "no recipient" });
                    continue;
                  }
                  await admin.rpc("enqueue_email", {
                    queue_name: "transactional_emails",
                    payload: {
                      to: recipient,
                      from: FROM_ADDRESS,
                      sender_domain: SENDER_DOMAIN,
                      subject,
                      html,
                      label: "job_reminder",
                      purpose: "transactional",
                      queued_at: new Date().toISOString(),
                      message_id: `reminder-${(job as any).id}-${ch}-${leadMin}-${Date.now()}`,
                    },
                  });
                  await admin.from("notification_log").insert({ job_id: (job as any).id, channel: ch, status: "queued" });
                  sent++;
                } else if (ch === "in_app") {
                  await admin.from("notification_log").insert({ job_id: (job as any).id, channel: ch, status: "logged" });
                  sent++;
                }
              } catch (e: any) {
                await admin.from("notification_log").insert({
                  job_id: (job as any).id,
                  channel: ch,
                  status: "failed",
                  error: String(e?.message || e).slice(0, 500),
                });
              }
            }
          }

          const merged = [...new Set([...alreadySent, ...due])];
          await admin.from("jobs").update({
            notified_lead_minutes: merged,
            notified_at: new Date().toISOString(),
          }).eq("id", (job as any).id);
        }

        // Quote follow-up alerts: one per job per day when due/overdue.
        try {
          const today = new Date().toISOString().slice(0, 10);
          const { data: ds } = await admin.from("app_settings").select("value").eq("key", "quote_followup_days").maybeSingle();
          const delay = Number((ds as any)?.value?.days) > 0 ? Number((ds as any).value.days) : 2;
          const { data: quotes } = await admin.from("jobs").select("id, company, address, created_at, extra_fields").eq("status", "Quote");
          for (const q of (quotes || []) as any[]) {
            const ef = q.extra_fields || {};
            const base = (ef.quoted_at || q.created_at || "").slice(0, 10);
            let next = ef.followup_next;
            if (!next && base) { const d = new Date(base + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + delay); next = d.toISOString().slice(0, 10); }
            if (!next || next > today || ef.followup_alerted === today) continue;
            await admin.from("app_alerts").insert({ title: "Quote follow-up due", body: `${q.company || "Client"} · ${q.address || ""} (due ${next})`, job_id: q.id });
            await admin.from("jobs").update({ extra_fields: { ...ef, followup_alerted: today } }).eq("id", q.id);
          }
        } catch (e) { console.error("quote followups", e); }

        return Response.json({ processed: (jobs || []).length, sent });
      },
    },
  },
});

async function resolveEmail(admin: any, job: any, ch: string): Promise<string | null> {
  if (ch === "email_client" && job.client_id) {
    const { data } = await admin.from("clients").select("email").eq("id", job.client_id).maybeSingle();
    return data?.email || null;
  }
  if (ch === "email_tech" && job.tech_name) {
    const { data: tech } = await admin.from("technicians").select("user_id").eq("tech_name", job.tech_name).maybeSingle();
    if (tech?.user_id) {
      const { data: prof } = await admin.from("profiles").select("email").eq("id", tech.user_id).maybeSingle();
      return prof?.email || null;
    }
  }
  return null;
}

