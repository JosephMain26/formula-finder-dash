# Project rules

- Technician report values are calculated in `src/lib/techReport.ts` and shared by previews, PDFs, and email; keep optional report columns and summaries in its registries so templates use the same values.
- Messaging/dispatch lives in `src/lib/dispatch.functions.ts`, `src/lib/messaging.functions.ts`, `dispatch_messages`, and `messaging_settings`; outbound sends and `/api/public/twilio/inbound` signature checks read `messaging_settings` first and fall back to env secrets.
- Keep tax IDs and W9 mailing details in admin/manager-only `w9_details`, never in broadly readable contact records; all three contact forms share W9 review and empty-field merging.
