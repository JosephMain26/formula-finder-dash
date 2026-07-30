# Plan: AI Rule Builder + If-This-Then-That Automation Center

## Part 1 — Fix the AI Training center

**Why it's failing today:** the "General AI Rules" box is free text that is only pasted into the parsing prompt. The model can and does ignore it, and nothing enforces it afterwards.

**Fix — write once with AI, enforce with plain logic:**

- New **Rule Builder** in Settings → AI Rules. You type a rule in plain English ("if the message mentions Elite, marketer is Elite Doors"; "if payment says zelle, set payment method to Zelle"; "phone numbers with 10 digits get +1").
- One single AI call turns that sentence into a structured rule: `{ when: field/message contains X, then: set field Y = Z }`. That call happens **once, when you save the rule** — never again.
- Saved rules are then applied by ordinary code after every parse, so they can never be ignored. A "Test rule" box lets you paste a sample message and see exactly which rules fire, before saving.
- Existing marketer mapping rules and corrections stay and are folded into the same list.
- Rules keep living in the existing `app_settings.ai_training` record — no migration needed.

## Part 2 — Automation Center (if this → then that)

New **Automations** tab in Settings (no extra screen in the nav). Each automation is a card: *Name • Trigger • Conditions • Actions • On/Off*.

**Triggers**
- Job created
- Job updated
- A field changed to a value (e.g. Status → Completed, Paid → true)
- Time-based (e.g. job completed N days ago and still unpaid; job scheduled tomorrow)
- Balance/parts threshold (e.g. a marketer's net balance goes above/below an amount)

**Conditions** — optional AND-list of field comparisons (job type, marketer, status, price >, paid, installer empty, etc.).

**Actions**
- Set a field on the job (status, paid, notes, installer, …)
- Send email or SMS using an existing message template, to marketer / tech / client / a fixed address
- Create an in-app alert shown in a bell menu on the dashboard
- Run one of your existing report automations now

**When they run**
- Job created / updated / field-changed → evaluated instantly in the app the moment a job is saved (no cron delay, no credits).
- Time-based and balance thresholds → evaluated by a new scheduled endpoint running every 15 minutes, alongside the existing report dispatcher.

Every run is logged so you can see what fired and why, and each automation has a "Run now (dry run)" preview that lists matching jobs and intended actions without applying them.

## Technical details

- **Migration:** two tables — `automations` (name, enabled, trigger jsonb, conditions jsonb, actions jsonb, last_run_at) and `app_alerts` (title, body, job_id, read_at, created_at). Admin-managed via existing role policies; grants + RLS included.
- **New files:** `src/lib/automations.ts` (types + CRUD), `src/lib/automationEngine.ts` (pure condition/action evaluator, shared by client and server), `src/components/settings/AutomationCenter.tsx`, `src/components/settings/AIRuleBuilder.tsx`, `src/routes/api/public/hooks/dispatch-automations.ts`.
- **Edited:** `src/lib/aiTraining.ts` (add `structuredRules`, apply function), `src/components/ParseMessageDialog.tsx` (apply structured rules post-parse), `src/routes/settings.tsx` (two tabs), `src/components/AddJobDialog.tsx` (fire job-save triggers), `src/routes/index.tsx` (alerts bell).
- **AI usage:** exactly one small gateway call per rule you create (rule text → JSON), via a server function using `openai/gpt-5.6-sol` with reasoning off. Nothing else calls AI at runtime.
- pg_cron entry added for the new dispatch endpoint (15 min), reusing the existing anon-key auth pattern.
