## What's wrong

Your scheduled emails are not being sent because the background job that triggers them is being rejected with a "401 Unauthorized" error every time it runs.

What I verified:
- Your "Marketers report" automation exists, is enabled, and is scheduled weekly (Mondays, 8:00 AM New York time). It has never successfully run (`last_run_at` is empty).
- The scheduled background task IS firing on time (every 15 minutes) and reaching the report endpoint.
- The report endpoint rejects every call with **401 Unauthorized**. I reproduced this directly.
- The **same problem affects job reminder emails** — that endpoint uses the identical security check and also returns 401.
- Email delivery infrastructure itself is healthy: the domain `notify.gedatajob.com` is verified, and the email-sending queue runs every 5 seconds. So once a report is allowed through, it will actually send.

### Root cause

The two endpoints check the incoming key against `process.env.SUPABASE_ANON_KEY`. That specific variable is **not available in the published server runtime** (only `SUPABASE_PUBLISHABLE_KEY` is injected). So the comparison is effectively "key vs. nothing", which always fails → 401.

I confirmed the key the scheduler sends is byte-for-byte identical to `SUPABASE_PUBLISHABLE_KEY`. So switching the check to that variable resolves it without changing any scheduled-job configuration.

## The fix

Update the authorization check in both public dispatcher routes to validate against the key that actually exists in the runtime:

1. `src/routes/api/public/hooks/dispatch-report-automations.ts`
2. `src/routes/api/public/hooks/dispatch-job-reminders.ts`

In each, change the check from comparing against `SUPABASE_ANON_KEY` to comparing against `SUPABASE_PUBLISHABLE_KEY` (keeping `SUPABASE_ANON_KEY` as a secondary fallback so nothing breaks if it ever becomes available).

```text
before:  if (!apikey || apikey !== process.env.SUPABASE_ANON_KEY) -> 401
after:   expected = SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY
         if (!apikey || !expected || apikey !== expected) -> 401
```

No database, cron, or schedule changes are needed.

## After the fix

- This change only takes effect on the **published** site, so it requires a Publish to go live.
- Once published, the next scheduled window (Monday 8:00 AM New York time) will send the marketer reports automatically. Job reminders resume immediately on their next cycle.
- To confirm it works right away (instead of waiting for Monday), I can trigger the report endpoint once manually after publishing — that will send the current marketer reports to the admin recipients. Let me know if you'd like that verification step.

## Out of scope

- No changes to report content, schedule, recipients, or how balances/reports are calculated.
- No changes to the email queue, domain, or templates.
