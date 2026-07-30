import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  matchesConditions,
  renderTemplate,
  coerceFieldValue,
  daysSince,
  type Automation,
  type Job,
} from "@/lib/automationEngine";

const SENDER_DOMAIN = "notify.gedatajob.com";
const FROM_ADDRESS = `Automations <reports@${SENDER_DOMAIN}>`;

async function queueEmail(admin: any, to: string, subject: string, html: string) {
  await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to,
      from: FROM_ADDRESS,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      label: "automation",
      purpose: "transactional",
      queued_at: new Date().toISOString(),
      message_id: `automation-${to}-${Date.now()}`,
    },
  });
}

async function log(admin: any, a: Automation, jobId: string | null, status: string, detail: string) {
  await admin.from("automation_runs").insert({
    automation_id: a.id,
    automation_name: a.name,
    job_id: jobId,
    status,
    detail: detail.slice(0, 500),
  });
}

/** Has this automation already fired for this job/marketer key? */
async function alreadyRan(admin: any, automationId: string, key: string) {
  const { data } = await admin
    .from("automation_runs")
    .select("id")
    .eq("automation_id", automationId)
    .eq("detail", key)
    .limit(1);
  return !!(data && data.length);
}

export const Route = createFileRoute("/api/public/hooks/dispatch-automations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("x-apikey");
        const expectedKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!apikey || !expectedKey || apikey !== expectedKey) {
          return new Response("Unauthorized", { status: 401 });
        }

        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false },
        });

        const { data: rows, error } = await admin.from("automations").select("*").eq("enabled", true);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const automations = ((rows || []) as unknown as Automation[]).filter(
          (a) => a.trigger?.type === "time_based" || a.trigger?.type === "balance_threshold"
        );
        if (!automations.length) return Response.json({ processed: 0, fired: 0 });

        const { data: jobsData } = await admin.from("jobs").select("*");
        const jobs = ((jobsData || []) as unknown) as Job[];
        const now = new Date();
        let fired = 0;

        for (const a of automations) {
          try {
            let targets: Job[] = [];

            if (a.trigger.type === "time_based") {
              const field = a.trigger.dateField || "job_date";
              const offset = a.trigger.offsetDays ?? 0;
              targets = jobs.filter((j) => {
                const d = daysSince(j, field, now);
                return d !== null && d === offset && matchesConditions(j, a.conditions);
              });
            } else {
              // Balance threshold: group open (unpaid to marketer) job value by marketer.
              const totals = new Map<string, number>();
              for (const j of jobs) {
                if (!matchesConditions(j, a.conditions)) continue;
                const name = (j.company_1 || j.company || "").trim();
                if (!name) continue;
                if (j.marketer_collected) continue;
                totals.set(name, (totals.get(name) || 0) + (Number(j.total_marketer) || 0));
              }
              const amount = a.trigger.balanceAmount ?? 0;
              const op = a.trigger.balanceOp || "gt";
              for (const [name, total] of totals) {
                const hit = op === "gt" ? total > amount : total < amount;
                if (!hit) continue;
                const key = `balance:${name}:${Math.round(total)}`;
                if (await alreadyRan(admin, a.id, key)) continue;
                for (const action of a.actions || []) {
                  if (action.type === "create_alert") {
                    await admin.from("app_alerts").insert({
                      title: action.subject || a.name,
                      body: `${name}: $${total.toFixed(2)}`,
                      automation_id: a.id,
                    });
                  } else if (action.type === "send_email") {
                    let to = action.address || "";
                    if (action.to === "marketer") {
                      const { data: c } = await admin
                        .from("companies")
                        .select("email")
                        .eq("company_name", name)
                        .maybeSingle();
                      to = (c as any)?.email || "";
                    }
                    if (to) {
                      await queueEmail(
                        admin,
                        to,
                        action.subject || a.name,
                        `<div style="font-family:system-ui,sans-serif">${(action.body || "").replace(
                          /\{\{\s*marketer\s*\}\}/g,
                          name
                        )}<br/><b>${name}: $${total.toFixed(2)}</b></div>`
                      );
                    }
                  } else if (action.type === "run_report" && action.reportAutomationId) {
                    await admin
                      .from("report_automations")
                      .update({ last_run_at: null })
                      .eq("id", action.reportAutomationId);
                  }
                }
                await log(admin, a, null, "ok", key);
                fired++;
              }
              await admin.from("automations").update({ last_run_at: now.toISOString() }).eq("id", a.id);
              continue;
            }

            for (const job of targets) {
              const key = `job:${job.id}`;
              if (await alreadyRan(admin, a.id, key)) continue;
              const patch: Record<string, unknown> = {};

              for (const action of a.actions || []) {
                if (action.type === "set_field" && action.field) {
                  patch[action.field] = coerceFieldValue(action.field, action.value ?? "");
                } else if (action.type === "create_alert") {
                  await admin.from("app_alerts").insert({
                    title: renderTemplate(action.subject || a.name, job),
                    body: renderTemplate(action.body || "", job),
                    job_id: job.id,
                    automation_id: a.id,
                  });
                } else if (action.type === "send_email") {
                  let to = action.address || "";
                  if (action.to === "marketer") {
                    const name = (job.company_1 || job.company || "").trim();
                    const { data: c } = await admin
                      .from("companies")
                      .select("email")
                      .eq("company_name", name)
                      .maybeSingle();
                    to = (c as any)?.email || "";
                  } else if (action.to === "client" && job.client_id) {
                    const { data: cl } = await admin
                      .from("clients")
                      .select("email")
                      .eq("id", job.client_id)
                      .maybeSingle();
                    to = (cl as any)?.email || "";
                  }
                  if (to) {
                    await queueEmail(
                      admin,
                      to,
                      renderTemplate(action.subject || a.name, job),
                      `<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${renderTemplate(
                        action.body || "",
                        job
                      )}</div>`
                    );
                  }
                } else if (action.type === "run_report" && action.reportAutomationId) {
                  await admin
                    .from("report_automations")
                    .update({ last_run_at: null })
                    .eq("id", action.reportAutomationId);
                }
              }

              if (Object.keys(patch).length) {
                await admin.from("jobs").update(patch).eq("id", job.id);
              }
              await log(admin, a, job.id, "ok", key);
              fired++;
            }

            await admin.from("automations").update({ last_run_at: now.toISOString() }).eq("id", a.id);
          } catch (e: any) {
            console.error("automation failed", a.id, String(e?.message || e));
          }
        }

        return Response.json({ processed: automations.length, fired });
      },
    },
  },
});
