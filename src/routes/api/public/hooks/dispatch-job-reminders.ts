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
        if (!apikey || apikey !== process.env.SUPABASE_ANON_KEY) {
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
          .is("notified_at", null)
          .not("job_date", "is", null)
          .gte("job_date", todayIso)
          .lte("job_date", horizonIso);

        if (error) return Response.json({ error: error.message }, { status: 500 });

        let sent = 0;
        for (const job of jobs || []) {
          const time = (job as any).job_time || "09:00:00";
          const dt = new Date(`${(job as any).job_date}T${time}`);
          if (Number.isNaN(dt.getTime())) continue;
          const lead = ((job as any).notify_lead_minutes ?? 60) * 60_000;
          const diff = dt.getTime() - nowMs;
          if (diff <= 0 || diff > lead) continue;

          const channels: string[] = (job as any).notify_channels || [];
          if (channels.length === 0) {
            // Still mark notified to avoid re-scanning every cycle
            await admin.from("jobs").update({ notified_at: new Date().toISOString() }).eq("id", (job as any).id);
            continue;
          }

          const summary = `${(job as any).job_type || "Job"} for ${(job as any).company || (job as any).company_1 || "client"} at ${(job as any).address || "TBD"} on ${(job as any).job_date} ${time.slice(0, 5)}`;
          const subject = `Reminder: ${(job as any).job_type || "Job"} at ${time.slice(0, 5)}`;
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
                    message_id: `reminder-${(job as any).id}-${ch}-${Date.now()}`,
                  },
                });
                await admin.from("notification_log").insert({ job_id: (job as any).id, channel: ch, status: "queued" });
                sent++;
              } else if (ch === "sms_tech" || ch === "sms_client") {
                const phone = await resolvePhone(admin, job, ch);
                if (!phone) {
                  await admin.from("notification_log").insert({ job_id: (job as any).id, channel: ch, status: "skipped", error: "no phone" });
                  continue;
                }
                const smsRes = await sendSms(phone, summary);
                await admin.from("notification_log").insert({
                  job_id: (job as any).id,
                  channel: ch,
                  status: smsRes.ok ? "sent" : "failed",
                  error: smsRes.ok ? null : smsRes.error,
                });
                if (smsRes.ok) sent++;
              } else if (ch === "in_app") {
                // In-app reminder is read by the client from job.notify_enabled +
                // due window; just log here for audit.
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

          await admin.from("jobs").update({ notified_at: new Date().toISOString() }).eq("id", (job as any).id);
        }

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

async function resolvePhone(admin: any, job: any, ch: string): Promise<string | null> {
  if (ch === "sms_client") {
    if (job.phone_no) return normalizePhone(job.phone_no);
    if (job.client_id) {
      const { data } = await admin.from("clients").select("phone").eq("id", job.client_id).maybeSingle();
      return data?.phone ? normalizePhone(data.phone) : null;
    }
  }
  if (ch === "sms_tech" && job.tech_name) {
    const { data } = await admin.from("technicians").select("phone_number").eq("tech_name", job.tech_name).maybeSingle();
    return data?.phone_number ? normalizePhone(data.phone_number) : null;
  }
  return null;
}

function normalizePhone(p: string): string {
  const digits = p.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

async function sendSms(to: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!apiKey || !twilioKey) return { ok: false, error: "Twilio not configured" };
  if (!from) return { ok: false, error: "TWILIO_FROM_NUMBER not set" };
  const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) return { ok: false, error: `Twilio ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { ok: true };
}
