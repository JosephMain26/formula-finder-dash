# Project rules

- Technician report values are calculated in `src/lib/techReport.ts` and shared by previews, PDFs, and email; keep optional report columns and summaries in its registries so templates use the same values.- Messaging/dispatch lives in src/lib/dispatch.functions.ts + dispatch_messages table; inbound Twilio webhook at /api/public/twilio/inbound verifies signature with TWILIO_AUTH_TOKEN.
