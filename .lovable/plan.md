## Skip SMS for now

Remove SMS from the Schedule reminders flow so the feature is complete without Twilio. Email + in-app reminders stay fully working. SMS can be added later.

### Changes

1. **`src/lib/notifications.ts`** — drop `sms_tech` and `sms_client` from `NotifyChannel` and `CHANNEL_LABELS`.
2. **`src/components/schedule/RescheduleDialog.tsx`** — remove SMS entries from `ALL_CHANNELS`; only In-app, Email tech, Email client remain.
3. **`src/routes/api/public/hooks/dispatch-job-reminders.ts`** — remove the SMS branch, `resolvePhone()`, `normalizePhone()`, and `sendSms()`. No Twilio env vars referenced.

No DB migration, no cron change, no new secret prompts.
