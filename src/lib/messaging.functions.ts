import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TWILIO_API = "https://api.twilio.com/2010-04-01";
const authHeader = (sid: string, token: string) => `Basic ${btoa(`${sid}:${token}`)}`;

async function assertAdmin(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!ok) throw new Error("Only admins can manage phone number settings.");
}

export type MessagingStatus = {
  connected: boolean;
  provider: string | null;
  accountSid: string | null;
  accountName: string | null;
  fromNumber: string | null;
  phoneNumberSid: string | null;
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  webhookSet: boolean;
  updatedAt: string | null;
};

export const getMessagingReady = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("messaging_settings")
      .select("from_number")
      .eq("id", "default")
      .maybeSingle();
    const envReady = Boolean(
      process.env["TWILIO_FROM_NUMBER"] && process.env["LOVABLE_API_KEY"] && process.env["TWILIO_API_KEY"],
    );
    return { ready: Boolean(data?.from_number) || envReady };
  });

export const getMessagingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MessagingStatus> => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("messaging_settings")
      .select("provider, account_sid, account_name, from_number, phone_number_sid, whatsapp_enabled, whatsapp_number, webhook_set, updated_at")
      .eq("id", "default")
      .maybeSingle();
    if (!data) {
      return {
        connected: false, provider: null, accountSid: null, accountName: null,
        fromNumber: null, phoneNumberSid: null, whatsappEnabled: false,
        whatsappNumber: null, webhookSet: false, updatedAt: null,
      };
    }
    return {
      connected: true,
      provider: data.provider,
      accountSid: data.account_sid,
      accountName: data.account_name,
      fromNumber: data.from_number,
      phoneNumberSid: data.phone_number_sid,
      whatsappEnabled: data.whatsapp_enabled,
      whatsappNumber: data.whatsapp_number,
      webhookSet: data.webhook_set,
      updatedAt: data.updated_at,
    };
  });

const ConnectSchema = z.object({
  accountSid: z.string().trim().regex(/^AC[a-fA-F0-9]{32}$/, "Account SID should start with AC followed by 32 characters."),
  authToken: z.string().trim().min(16, "Please enter a valid Auth Token."),
});

export const connectProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ConnectSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const res = await fetch(`${TWILIO_API}/Accounts/${data.accountSid}.json`, {
      headers: { Authorization: authHeader(data.accountSid, data.authToken) },
    });
    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? "Twilio rejected those credentials. Double-check your Account SID and Auth Token."
          : `Could not reach Twilio (${res.status}).`,
      );
    }
    const account = (await res.json()) as { friendly_name?: string };
    const accountName = account.friendly_name?.trim() || "Twilio Account";
    const { error } = await context.supabase.from("messaging_settings").upsert({
      id: "default",
      provider: "twilio",
      account_sid: data.accountSid,
      account_name: accountName,
      auth_token: data.authToken,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { accountName, accountSid: data.accountSid };
  });

export type ProviderNumber = { sid: string; phoneNumber: string; friendlyName: string; smsCapable: boolean };

export const listProviderNumbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ numbers: ProviderNumber[] }> => {
    await assertAdmin(context.supabase, context.userId);
    const { data: cfg } = await context.supabase
      .from("messaging_settings")
      .select("account_sid, auth_token")
      .eq("id", "default")
      .maybeSingle();
    if (!cfg) throw new Error("Connect Twilio first.");
    const res = await fetch(`${TWILIO_API}/Accounts/${cfg.account_sid}/IncomingPhoneNumbers.json?PageSize=50`, {
      headers: { Authorization: authHeader(cfg.account_sid, cfg.auth_token) },
    });
    if (!res.ok) throw new Error(`Could not load numbers from Twilio (${res.status}).`);
    const json = (await res.json()) as {
      incoming_phone_numbers?: Array<{ sid: string; phone_number: string; friendly_name?: string; capabilities?: { sms?: boolean } }>;
    };
    const numbers = (json.incoming_phone_numbers ?? []).map((n) => ({
      sid: n.sid,
      phoneNumber: n.phone_number,
      friendlyName: n.friendly_name || n.phone_number,
      smsCapable: n.capabilities?.sms !== false,
    }));
    return { numbers };
  });

const SelectNumberSchema = z.object({
  phoneNumber: z.string().trim().min(7).max(32),
  phoneNumberSid: z.string().trim().min(5).max(64),
  origin: z.string().trim().url(),
});

export const selectProviderNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SelectNumberSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: cfg } = await context.supabase
      .from("messaging_settings")
      .select("account_sid, auth_token")
      .eq("id", "default")
      .maybeSingle();
    if (!cfg) throw new Error("Connect Twilio first.");

    let webhookSet = false;
    let webhookWarning: string | null = null;
    const isPublicHttps = data.origin.startsWith("https://") && !data.origin.includes("localhost");
    if (isPublicHttps) {
      const smsUrl = `${data.origin.replace(/\/$/, "")}/api/public/twilio/inbound`;
      const res = await fetch(`${TWILIO_API}/Accounts/${cfg.account_sid}/IncomingPhoneNumbers/${data.phoneNumberSid}.json`, {
        method: "POST",
        headers: {
          Authorization: authHeader(cfg.account_sid, cfg.auth_token),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ SmsUrl: smsUrl, SmsMethod: "POST" }),
      });
      if (res.ok) webhookSet = true;
      else webhookWarning = "Number saved, but incoming texts could not be configured automatically.";
    } else {
      webhookWarning = "Number saved. Open your published site and re-select this number to auto-configure incoming texts.";
    }

    const { error } = await context.supabase
      .from("messaging_settings")
      .update({
        from_number: data.phoneNumber,
        phone_number_sid: data.phoneNumberSid,
        webhook_set: webhookSet,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");
    if (error) throw new Error(error.message);
    return { fromNumber: data.phoneNumber, webhookSet, webhookWarning };
  });

const WhatsAppSchema = z.object({
  enabled: z.boolean(),
  whatsappNumber: z.string().trim().max(32),
});

export const updateWhatsAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => WhatsAppSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const cleaned = data.whatsappNumber ? data.whatsappNumber.replace(/[^\d+]/g, "") : null;
    const { error } = await context.supabase
      .from("messaging_settings")
      .update({
        whatsapp_enabled: data.enabled,
        whatsapp_number: cleaned,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const TestSchema = z.object({
  to: z.string().trim().min(7).max(32),
  channel: z.enum(["sms", "whatsapp"]),
});

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TestSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: cfg } = await context.supabase
      .from("messaging_settings")
      .select("account_sid, auth_token, from_number, whatsapp_number")
      .eq("id", "default")
      .maybeSingle();
    if (!cfg || !cfg.from_number) throw new Error("Pick a phone number first.");
    const to = data.to.replace(/[^\d+]/g, "");
    const wa = data.channel === "whatsapp";
    const fromNum = wa ? cfg.whatsapp_number || cfg.from_number : cfg.from_number;
    const res = await fetch(`${TWILIO_API}/Accounts/${cfg.account_sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: authHeader(cfg.account_sid, cfg.auth_token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: wa ? `whatsapp:${to}` : to,
        From: wa ? `whatsapp:${fromNum}` : fromNum,
        Body: "Test message from Leadz — your phone number is connected!",
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      let msg = `Twilio rejected the test (${res.status}).`;
      try { const parsed = JSON.parse(errBody) as { message?: string }; if (parsed.message) msg = parsed.message; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return { ok: true };
  });

export const disconnectProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("messaging_settings").delete().eq("id", "default");
    if (error) throw new Error(error.message);
    return { ok: true };
  });