import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Twilio inbound SMS / WhatsApp webhook. Set as "A message comes in" URL on your Twilio number.
// Requires TWILIO_AUTH_TOKEN to verify Twilio's signature.
export const Route = createFileRoute("/api/public/twilio/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TWILIO_AUTH_TOKEN;
        const raw = await request.text();
        const params = new URLSearchParams(raw);
        if (!token) return new Response("Not configured", { status: 503 });
        const sig = request.headers.get("x-twilio-signature") ?? "";
        const sorted = [...params.keys()].sort().map((k) => k + params.get(k)).join("");
        const expected = createHmac("sha1", token).update(request.url + sorted).digest("base64");
        if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          return new Response("Invalid signature", { status: 401 });
        }
        const fromRaw = (params.get("From") ?? "").slice(0, 60);
        const body = (params.get("Body") ?? "").slice(0, 4000);
        const channel = fromRaw.startsWith("whatsapp:") ? "whatsapp" : "sms";
        const phone = fromRaw.replace("whatsapp:", "");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tech } = await supabaseAdmin.from("technicians").select("tech_name").eq("phone_number", phone).maybeSingle();
        await supabaseAdmin.from("dispatch_messages").insert({
          phone, body, channel, direction: "in", status: "received",
          contact_name: tech?.tech_name ?? null, contact_type: tech ? "technician" : "other",
        });
        await supabaseAdmin.from("app_alerts").insert({ title: `New ${channel === "whatsapp" ? "WhatsApp" : "text"} from ${tech?.tech_name ?? phone}`, body: body.slice(0, 200) });
        return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
      },
    },
  },
});
