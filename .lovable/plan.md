## 1. Deposit tracking on jobs

Add three columns to `jobs`:
- `deposit_received` (boolean, default false)
- `deposit_amount` (numeric, default 0)
- `deposit_date` (date, nullable)

UI changes:
- **Job form (`AddJobDialog`)**: new "Deposit" panel with a checkbox; when checked, reveals amount + date.
- **Jobs table (`JobsTable`)**: a small "💰 Deposit" badge on rows where `deposit_received = true` (tooltip shows amount + date).
- **Filters**: a "Has deposit" quick filter.

## 2. Completion / install date

Add two columns to `jobs`:
- `scheduled_completion_date` (date, nullable) — planned install/completion day
- `completed_at_date` (date, nullable) — actual completion; auto-set when status flips to "Completed", editable.

UI:
- Two new date fields in the job form, grouped near `job_date`.
- Surfaced as optional columns in the dashboard table and schedule view.

## 3. Message templates system

### New tables
- `message_templates` — admin-managed library
  - `name`, `recipient_type` ('technician' | 'marketer' | 'installer' | 'client'), `channel_default` ('whatsapp' | 'sms'), `body` (text with `{{variables}}`), `is_active`
- `message_send_log` — audit of sent/opened messages
  - `job_id`, `template_id`, `recipient_type`, `recipient_name`, `recipient_phone`, `channel`, `body_rendered`, `sent_by`, `sent_at`

RLS: admins/managers manage templates; authenticated users insert send logs.

### Settings UI
New **"Message Templates"** tab in `/settings`:
- List + create/edit/delete templates.
- Editor: name, recipient type, default channel, body textarea, and a sidebar of insertable variables (click to insert `{{var}}` at cursor).
- Live preview rendered with a sample job.

### Supported variables
From the job: `{{client_name}}`, `{{address}}`, `{{phone}}`, `{{job_date}}`, `{{job_time}}`, `{{job_type}}`, `{{comp_type}}`, `{{price}}`, `{{deposit_amount}}`, `{{scheduled_completion_date}}`, `{{tech_name}}`, `{{installer_name}}`, `{{marketer}}`, `{{notes}}`, `{{po_number}}`.

### Send-message dialog (from a job row)
- New "Send message" action in the job row menu.
- Dialog: pick recipient type → pick template (filtered by type) → pick recipient (auto-loaded from job's tech/installer/marketer with editable phone) → choose channel (WhatsApp link / Twilio SMS) → editable preview with variables already filled → Send.
- **WhatsApp**: opens `https://wa.me/<phone>?text=<encoded>` in a new tab.
- **SMS via Twilio**: server function calls Twilio through the existing connector and writes a row to `message_send_log`.
- Both paths log to `message_send_log`.

## Technical notes
- Twilio send: `createServerFn` with `requireSupabaseAuth` calling Twilio Messages API via the connector gateway (`TWILIO_API_KEY` already present). Validate phone (E.164) and body length with Zod.
- Variable rendering is a small pure helper (`renderTemplate(body, job)`) used in both preview and send paths.
- Completion auto-set: handled in the existing job-update path (no trigger needed) so it stays editable.
- No edge functions added; all backend work goes through TanStack server functions.

## Validation
- Save job with deposit → badge shows in table.
- Move job to Completed → `completed_at_date` auto-fills, still editable.
- Create installer template with `{{address}} {{job_date}}` → send via WhatsApp → URL opens with rendered text. Send via SMS → message arrives, log row written.