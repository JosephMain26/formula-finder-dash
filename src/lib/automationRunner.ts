import { supabase } from "@/integrations/supabase/client";
import {
  matchesConditions,
  renderTemplate,
  coerceFieldValue,
  triggerFires,
  type Automation,
  type Job,
} from "@/lib/automationEngine";
import { sendAutomationEmail } from "@/lib/automationEmail.functions";
import { sendSms } from "@/lib/messages.functions";

async function logRun(a: Automation, jobId: string | null, status: string, detail: string) {
  try {
    await (supabase as any).from("automation_runs").insert({
      automation_id: a.id,
      automation_name: a.name,
      job_id: jobId,
      status,
      detail: detail.slice(0, 500),
    });
  } catch {
    /* logging must never break the save */
  }
}

async function resolveEmail(to: string | undefined, job: Job, custom?: string): Promise<string | null> {
  if (to === "custom") return custom?.trim() || null;
  if (to === "marketer") {
    const name = (job.company_1 || job.company || "").trim();
    if (!name) return null;
    const { data } = await (supabase as any)
      .from("companies")
      .select("email")
      .eq("company_name", name)
      .maybeSingle();
    return data?.email || null;
  }
  if (to === "client") {
    if (!job.client_id) return null;
    const { data } = await (supabase as any)
      .from("clients")
      .select("email")
      .eq("id", job.client_id)
      .maybeSingle();
    return data?.email || null;
  }
  return null;
}

async function resolvePhone(to: string | undefined, job: Job, custom?: string): Promise<string | null> {
  if (to === "custom") return custom?.trim() || null;
  if (to === "client") return job.phone_no || null;
  if (to === "tech") {
    const name = (job.tech_name || "").trim();
    if (!name) return null;
    const { data } = await (supabase as any)
      .from("technicians")
      .select("phone_number")
      .eq("tech_name", name)
      .maybeSingle();
    return data?.phone_number || null;
  }
  return null;
}

/**
 * Evaluate every enabled job-triggered automation after a job is saved.
 * Runs entirely on deterministic logic — no AI, no credits.
 */
export async function runJobAutomations(job: Job, prev: Job | null): Promise<void> {
  let automations: Automation[] = [];
  try {
    const { data } = await (supabase as any).from("automations").select("*").eq("enabled", true);
    automations = (data || []) as Automation[];
  } catch {
    return;
  }
  if (!automations.length) return;

  const jobPatch: Record<string, unknown> = {};

  for (const a of automations) {
    const t = a.trigger || ({ type: "job_created" } as Automation["trigger"]);
    if (t.type !== "job_created" && t.type !== "job_updated" && t.type !== "field_changed") continue;
    if (!triggerFires(t, job, prev)) continue;
    if (!matchesConditions(job, a.conditions)) continue;

    for (const action of a.actions || []) {
      try {
        if (action.type === "set_field" && action.field) {
          jobPatch[action.field] = coerceFieldValue(action.field, action.value ?? "");
          await logRun(a, job.id, "ok", `Set ${action.field} = ${action.value}`);
        } else if (action.type === "create_alert") {
          await (supabase as any).from("app_alerts").insert({
            title: renderTemplate(action.subject || a.name, job),
            body: renderTemplate(action.body || "", job),
            job_id: job.id,
            automation_id: a.id,
          });
          await logRun(a, job.id, "ok", "Alert created");
        } else if (action.type === "send_email") {
          const to = await resolveEmail(action.to, job, action.address);
          if (!to) {
            await logRun(a, job.id, "skipped", "No email address found");
            continue;
          }
          await sendAutomationEmail({
            data: {
              to,
              subject: renderTemplate(action.subject || a.name, job),
              html: `<div style="font-family:system-ui,sans-serif;font-size:14px;white-space:pre-wrap">${renderTemplate(
                action.body || "",
                job
              )}</div>`,
            },
          });
          await logRun(a, job.id, "ok", `Email queued to ${to}`);
        } else if (action.type === "send_sms") {
          const to = await resolvePhone(action.to, job, action.address);
          if (!to) {
            await logRun(a, job.id, "skipped", "No phone number found");
            continue;
          }
          await sendSms({ data: { to, body: renderTemplate(action.body || "", job).slice(0, 1500) } });
          await logRun(a, job.id, "ok", `SMS sent to ${to}`);
        } else if (action.type === "run_report" && action.reportAutomationId) {
          // Nudge the scheduled report to run on the next dispatcher pass.
          await (supabase as any)
            .from("report_automations")
            .update({ last_run_at: null })
            .eq("id", action.reportAutomationId);
          await logRun(a, job.id, "ok", "Report queued");
        }
      } catch (e: any) {
        await logRun(a, job.id, "error", String(e?.message || e));
      }
    }

    try {
      await (supabase as any).from("automations").update({ last_run_at: new Date().toISOString() }).eq("id", a.id);
    } catch {
      /* ignore */
    }
  }

  if (Object.keys(jobPatch).length) {
    try {
      await (supabase as any).from("jobs").update(jobPatch).eq("id", job.id);
    } catch {
      /* ignore */
    }
  }
}
