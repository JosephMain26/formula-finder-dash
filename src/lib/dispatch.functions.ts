import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TWILIO = "https://connector-gateway.lovable.dev/twilio";

const SendSchema = z.object({
  phone: z.string().min(5).max(32),
  body: z.string().min(1).max(1600),
  channel: z.enum(["sms", "whatsapp"]),
  contact_name: z.string().max(120).optional(),
  contact_type: z.string().max(30).optional(),
  job_id: z.string().uuid().optional(),
});

export const sendDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SendSchema.parse(i))
  .handler(async ({ data, context }) => {
    const to = data.phone.replace(/[^\d+]/g, "");
    const from = process.env.TWILIO_FROM_NUMBER;
    const lk = process.env.LOVABLE_API_KEY;
    const tk = process.env.TWILIO_API_KEY;
    let status = "sent";
    let error: string | null = null;
    if (!from || !lk || !tk) {
      status = "pending_number";
      error = "No sending phone number set up yet — message saved only.";
    } else {
      const wa = data.channel === "whatsapp";
      const res = await fetch(`${TWILIO}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": tk, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: wa ? `whatsapp:${to}` : to, From: wa ? `whatsapp:${from}` : from, Body: data.body }),
      });
      if (!res.ok) { status = "failed"; error = `Twilio [${res.status}]: ${await res.text()}`; }
    }
    const { error: dbErr } = await context.supabase.from("dispatch_messages").insert({
      phone: to, body: data.body, channel: data.channel, direction: "out", status, error,
      contact_name: data.contact_name ?? null, contact_type: data.contact_type ?? "other",
      job_id: data.job_id ?? null, created_by: context.userId,
    });
    if (dbErr) throw new Error(dbErr.message);
    return { status, error };
  });

const AgentSchema = z.object({
  instruction: z.string().min(1).max(2000),
  history: z.array(z.object({ direction: z.string(), body: z.string() })).max(30),
  contact_name: z.string().max(120).optional(),
  jobs: z.string().max(4000).optional(),
});

/** AI assistant: drafts a short message to a technician/sub based on the thread and the user's instruction. */
export const agentDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AgentSchema.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const thread = data.history.map((m) => `${m.direction === "in" ? "THEM" : "ME"}: ${m.body}`).join("\n");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [
          { role: "system", content: "You are a dispatch assistant for a field-service company (garage doors, locksmith, painting). Write ONE short, clear, friendly text message to the technician or subcontractor. Plain text only, no quotes, under 320 characters. Include job address/time if relevant." },
          { role: "user", content: `Contact: ${data.contact_name ?? "unknown"}\nRecent jobs:\n${data.jobs ?? "n/a"}\n\nConversation:\n${thread || "(none)"}\n\nWhat I want to say: ${data.instruction}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(res.status === 429 ? "AI is busy, try again shortly" : res.status === 402 ? "AI credits exhausted" : `AI error ${res.status}`);
    const j: any = await res.json();
    return { text: String(j.choices?.[0]?.message?.content ?? "").trim() };
  });
