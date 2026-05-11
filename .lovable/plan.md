## Two-Way SMS via Twilio

Add a phone number to the system that can send and receive texts, with a dedicated **Messages** page for conversations with clients and incoming leads from marketers.

### Setup (one-time, by you)

1. Buy/own a Twilio phone number (SMS-enabled, US long code / toll-free / 10DLC as needed).
2. Connect Twilio via Lovable's built-in connector — you'll be prompted to paste your Account SID + API Key Secret. No code-level secrets to manage.
3. Add `TWILIO_FROM_NUMBER` as a secret (your Twilio number in E.164, e.g. `+15551234567`).
4. After deploy, paste the inbound webhook URL into Twilio Console → your number → *A message comes in* = `https://<published-url>/api/public/twilio-inbound`.

### Database (1 new table)

```
messages
  id, direction ('inbound'|'outbound'), from_number, to_number, body,
  twilio_sid, status, error, client_id (nullable, auto-matched by phone),
  user_id (nullable, who sent it), created_at
```
RLS: authenticated users can read; insert via server only. Realtime enabled so the inbox updates live.

### Backend (TanStack server functions + 1 public route)

- **`sendSms` server function** (`src/lib/sms.functions.ts`) — auth-protected. Validates with Zod, calls Twilio gateway `POST /Messages.json`, inserts outbound row in `messages`, returns the row.
- **Inbound webhook** (`src/routes/api/public/twilio-inbound.ts`) — verifies Twilio signature (`X-Twilio-Signature` via `auth-token`), parses `From`/`To`/`Body`/`MessageSid`, auto-links to a client by matching `clients.phone` (normalized digits), inserts inbound row, returns TwiML `<Response/>`.
- **Status callback** (`/api/public/twilio-status`) — optional, updates `status` (delivered/failed) by `twilio_sid`.

### Frontend

**New page `/messages`** (added to `MobileNav` + sidebar):
- Left pane: conversation list grouped by phone number, showing client name (if matched), last message snippet, unread indicator, sorted by recent.
- Right pane: thread view (chat bubbles), composer with templates dropdown + send button. Subscribes to `messages` realtime channel for live updates.
- "+ New Message" button to start a thread by typing a phone number (with client autocomplete).

**Templates**: stored in `app_settings` under key `sms_templates` as a JSON array `[{name, body}]`. Managed inline from the composer (Add / Edit / Delete). No new table needed.

**Client dialog integration**: in `ClientDialog`, add a "Send SMS" button next to phone — opens the same composer prefilled with the client's number and jumps to `/messages` thread on send.

**Unmatched inbound (marketer leads)**: inbound messages with no client match show in Messages with a "Create client" button that opens the existing new-client flow, prefilled with the phone number.

### Technical notes

- All Twilio calls go through Lovable's connector gateway (`connector-gateway.lovable.dev/twilio`) — no Twilio SDK, no direct credentials in code.
- Phone normalization helper (digits-only, E.164) shared between client matching and outbound sends.
- Rate limit `sendSms` server-side (simple in-memory: max 20/min per user) to prevent abuse.
- Signature verification on every inbound request — reject 401 if invalid.

### Files

- New: `supabase/migrations/...sms_messages.sql`, `src/lib/sms.functions.ts`, `src/lib/phone.ts`, `src/routes/api/public/twilio-inbound.ts`, `src/routes/api/public/twilio-status.ts`, `src/routes/messages.tsx`, `src/components/sms/ConversationList.tsx`, `src/components/sms/MessageThread.tsx`, `src/components/sms/Composer.tsx`, `src/components/sms/TemplatesManager.tsx`.
- Edited: `src/components/MobileNav.tsx` (add nav link), `src/routes/clients.tsx` + `ClientDialog` (Send SMS button).

### What you'll need to provide

- Twilio account (connected via the connector picker).
- `TWILIO_FROM_NUMBER` secret (your Twilio phone number in E.164 format).
- After deploy: paste the inbound webhook URL into Twilio Console.
