import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SENDER_DOMAIN = "notify.gedatajob.com";
const FROM_ADDRESS = `Automations <reports@${SENDER_DOMAIN}>`;

const EmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  html: z.string().min(1).max(20000),
});

/** Queue a transactional email triggered by an automation action. */
export const sendAutomationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EmailSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("enqueue_email" as any, {
      queue_name: "transactional_emails",
      payload: {
        to: data.to,
        from: FROM_ADDRESS,
        sender_domain: SENDER_DOMAIN,
        subject: data.subject,
        html: data.html,
        label: "automation",
        purpose: "transactional",
        queued_at: new Date().toISOString(),
        message_id: `automation-${data.to}-${Date.now()}`,
      },
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
