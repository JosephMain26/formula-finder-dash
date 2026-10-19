# Quote tracking and follow-ups

## What you'll get

**1. Two new dashboard cards (top of home page)**
- **Open jobs**: every job that is not Completed or Cancelled (right now: 1 Scheduled + 5 Quote).
- **Quotes given**: jobs with status "Quote", plus estimates that were sent but not yet approved or declined. A small line under the number shows how many are **due for follow-up today or overdue**.

**2. Tap a card to see the list**
- Tapping a card opens a side panel (full screen on phone) listing those jobs: client, phone, address, quote amount, date quoted, days since quote, next follow-up date.
- Tapping a row opens the full job, the same edit form you use today. Linked estimates open from there.

**3. Follow-up system for quotes**
- Each quoted job gets a **Next follow-up** date (default: 2 days after it becomes a Quote; you can change the default in Settings) and a **follow-up log** (date, note, outcome).
- Quick buttons on each row: **Call**, **Text** (uses your existing message templates), **Log follow-up** (adds a note and picks the next date: +1, +3, +7 days or custom), **Won** (sets status to Scheduled), **Lost** (sets status to Cancelled with a reason).
- Rows are colored: red = overdue, amber = due today, gray = upcoming.
- The alerts bell shows a daily alert for follow-ups that are due, using the existing reminder schedule, so nothing gets missed.

## Technical notes
- No new tables: follow-up data lives in `jobs.extra_fields` (`followup_next`, `followup_log[]`, `quoted_at`, `lost_reason`); `quoted_at` is set when status first becomes Quote (fallback `created_at`).
- New `src/lib/quotes.ts`: `isOpenJob`, `isQuoteJob`, `followupState` (overdue/today/upcoming), shared by cards, panel, and alert job; small unit tests for these rules.
- New `src/components/QuotesPanel.tsx` (Sheet) and two cards added on `src/routes/index.tsx`; row click opens existing `AddJobDialog` in edit mode.
- Default follow-up delay stored in app settings, editable under Settings > Jobs.
- Due-alert check added to the existing `dispatch-job-reminders` hook, writing to `app_alerts` once per job per day.
