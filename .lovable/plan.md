## Goal

On the **Reports → Automation Center**, today the toggle **"Send each marketer their own individual report"** does two things at once:

1. Splits the report into one-per-marketer, **and**
2. Forces it to be emailed to each marketer's own contact, hiding every other recipient option.

You want to separate these. Specifically: you want to **build a report per marketer** but then decide whether to actually send it to the marketer's contact — or instead just export those per-marketer reports and send them to people **you** pick (a manager, yourself, custom emails, etc.).

## What changes

### 1. Split the one toggle into two clear controls (`src/routes/reports.tsx`)

Rename the existing toggle to describe only the splitting behavior:

```text
[x] Create a separate report for each marketer
```

When that is ON, show a second sub-option:

```text
    [ ] Also send each marketer their own report (to their contact email)
```

And — this is the key fix — keep the existing recipient choices (**By role**, **Specific marketers**, **Custom emails**) visible **even when per-marketer is on**. So you can build per-marketer reports and route them to whoever you choose, with the "send to the marketer" switch fully optional.

Behavior summary:
- Per-marketer OFF → unchanged (one combined report to chosen recipients).
- Per-marketer ON + "send to marketer" OFF → a report is generated for each marketer and sent only to the recipients you picked (roles / emails / specific marketers). The marketers themselves get nothing.
- Per-marketer ON + "send to marketer" ON → each marketer also gets their own report at their contact email (today's behavior), in addition to your chosen recipients.

### 2. New recipients field (`src/lib/reportAutomations.ts`)

Add `sendToMarketer?: boolean` to `AutomationRecipients` (defaults to `false`). No database migration needed — recipients are stored as flexible JSON, so this stays cheap on credits.

### 3. Dispatch logic (`src/routes/api/public/hooks/dispatch-report-automations.ts`)

Rework the per-marketer branch so it honors the two new settings:
- For each marketer, build that marketer's filtered report (as today).
- If `sendToMarketer` is true → send it to that marketer's own contact email (current behavior).
- Always also send each per-marketer report to your chosen recipients (role emails + custom emails + any specifically selected marketer emails). The chosen recipient gets one email per marketer, with the marketer's name in the subject so they're easy to tell apart.
- Dedupe so a recipient never receives the same marketer's report twice.

## Out of scope
- No new table / migration.
- No change to the cron schedule, the on-page PDF builder, or saved templates.
- The report **content** per marketer is unchanged — only who receives it.

## Technical notes
- Files touched: `src/routes/reports.tsx`, `src/lib/reportAutomations.ts`, `src/routes/api/public/hooks/dispatch-report-automations.ts`.
- `blank()` and `save()` in `reports.tsx` will default `sendToMarketer` to `false`.
- Existing automations keep working: missing `sendToMarketer` is treated as `false`, so today's per-marketer automations would start routing to chosen recipients; to preserve their old "send to marketer" behavior you'd flip the new sub-toggle on (or we can default it to mirror the old behavior for existing rows — say the word if you'd prefer that).
