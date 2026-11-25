# Phone Number Setup page in Settings

## Goal
A new company owner connects their phone number for Messages in 3 steps, with no technical knowledge and nothing set up behind the scenes.

## What the owner sees (Settings → Messaging → "Phone number")
1. **Connect Twilio**: two boxes (Account SID, Auth Token) with a short "Where do I find these?" guide that links to the Twilio Console. Press **Connect**, and the app checks the details right away ("Connected as <account name>" or a clear error).
2. **Pick a number**: a list of the phone numbers already on their Twilio account. If they have none, a **Buy a number** button opens Twilio's number store, then **Refresh**.
3. **Done**: the app sets up incoming texts for that number by itself, so replies show up in Messages without copying any webhook links. A status card shows: Connected, number, SMS on, WhatsApp (optional switch with its own WhatsApp sender number), and a **Send test text** box.
- **Disconnect** button, and a safety tip about turning on Twilio's protection against fake texts.

## How it behaves
- Only admins can see or change it. The Auth Token is never shown again after saving (it appears as ••••1234).
- Messages page: sending uses the saved number. Until a number is connected, messages stay saved as "waiting for number" (works the same as now), with a "Set up phone number" link.
- Incoming texts are verified with the saved token.

## Technical details
- New table `messaging_settings` (single row): provider, account_sid, auth_token, from_number, whatsapp_number, webhook_set, updated_at. RLS + grants: admins only; the token is never returned to the browser.
- `src/lib/messaging.functions.ts` (admin-checked server functions): `connectProvider` (validates via Twilio `GET /Accounts/{sid}.json` with Basic auth), `listNumbers` (`IncomingPhoneNumbers.json`), `selectNumber` (saves the number and sets its `SmsUrl` to `<origin>/api/public/twilio/inbound`), `sendTest`, `disconnect`, `getStatus` (masked).
- `sendDispatch` and the inbound webhook read the saved settings first and fall back to the current environment secrets/gateway.
- New `src/components/settings/PhoneNumberSetup.tsx`, added to the Settings sidebar; AGENTS.md rule updated.
