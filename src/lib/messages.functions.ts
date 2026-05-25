import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

const SendSmsSchema = z.object({
  to: z.string().min(5).max(32).regex(/^\+?[0-9\s\-().]+$/),
  from: z.string().min(5).max(32).regex(/^\+?[0-9\s\-().]+$/).optional(),
  body: z.string().min(1).max(1600),
});

export const sendSms = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SendSmsSchema.parse(input))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured (connect Twilio in Connectors)");

    const fromNumber = data.from || process.env.TWILIO_FROM_NUMBER;
    if (!fromNumber) {
      throw new Error("No 'from' phone number provided. Set TWILIO_FROM_NUMBER or pass one in the request.");
    }

    const toDigits = data.to.replace(/[^\d+]/g, "");
    const fromDigits = fromNumber.replace(/[^\d+]/g, "");

    const res = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: toDigits, From: fromDigits, Body: data.body }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Twilio error [${res.status}]: ${json?.message || JSON.stringify(json)}`);
    }
    return { sid: json.sid as string, status: json.status as string };
  });
