## Goal

When pasting a "closing" text in **Parse Message**, instead of always opening a blank new-job form, detect whether the message belongs to an existing job from the last 30 days and let you update it (with a confirmation/diff preview). Learn from your match overrides and field edits.

Designed to use the **least credits**: only **one AI call** (the existing `parse-job-message` edge function). All matching is done locally against rows already in the app.

## Flow

```
Paste text → [1 AI parse call] → local match search
        ├─ matches found → Match Picker (best match + alternates)
        │       ├─ Confirm match → Diff Preview (per-field old → new, editable, checkboxes)
        │       │       └─ Apply → UPDATE job + log corrections + (if overridden) log match override
        │       └─ "None of these / create new" → existing new-job dialog
        └─ no matches → "No match found. Create new job?" confirmation → new-job dialog
```

## Match logic (local, no AI)

Candidates: jobs from **last 30 days, any status**.

Score each candidate; pick the highest score ≥ threshold:
- **Phone match** (normalized digits, last 10): +100
- **Customer name** (notes/extra_fields contains parsed name, case-insensitive): +40
- **Address** (fuzzy: normalize, token overlap ≥ 60% OR street number + first street token match): +60

Threshold: score ≥ 60 → show as match. Show top 3 candidates so you can pick the right one.

## UI changes (`src/components/ParseMessageDialog.tsx`)

After parse succeeds:
1. Fetch candidate jobs once (single query: `jobs.select(...).gte(created_at, now-30d)` limited to fields needed for matching + display).
2. Score locally.
3. New **MatchReviewDialog** (added to same file or new file):
   - Top section: parsed summary (customer, phone, address, price, parts, payment, tech).
   - Match list: up to 3 candidates with score badge, job date, customer, address, tech, current status. Radio-select.
   - "Create new job instead" option.
   - On "Continue":
     - If match selected → **DiffPreviewDialog**.
     - Else → existing `JobDialog` prefill flow (unchanged).
4. **DiffPreviewDialog**:
   - Table: Field | Current value | New value | ✅ apply checkbox (default on for changed fields with non-empty new value) | inline editable "New value" input.
   - Fields shown: `phone_no`, `address`, `job_type`, `price`, `parts`, `co_parts`, `office_parts`, `tech_name`, `payment`, `notes` (append, not overwrite), `company`, `status` (auto-suggest "Completed" if price present), and parsed installation parts → just appended to notes for now (no install rows touched).
   - Buttons: **Apply Updates**, **Edit in full form** (opens `JobDialog` for that job with merged values), **Cancel**.

## Update mechanics

- On Apply: `supabase.from("jobs").update({ ...checkedFields }).eq("id", jobId)`.
- Notes: append `\n--- Closing ${todayISO} ---\n${parsed.notes}` rather than overwrite.
- Recompute `total_marketer`, `total_tech`, `total_office`, `cc_fee` using the same formula as `AddJobDialog.completeSubmit` (re-fetch the job, merge, compute). Extract that math into a small helper `src/lib/jobCalc.ts` so both dialogs use it.

## Learning (extends `src/lib/aiTraining.ts`)

Add two new arrays in `app_settings` under key `ai_training`:

1. **Field corrections** (already exists): when user edits a "New value" before Apply, record `{ field, parsed, corrected, snippet }` into `corrections` (capped 100). The next parse passes top 25 to the LLM (already wired).
2. **Match overrides** (new): when the user picks a different candidate than the top-scored one, or picks "Create new" despite a suggested match, append to a new `matchOverrides: Array<{ at, phone, customerNameParsed, addressParsed, pickedJobId|null, suggestedJobId, snippet }>`. Capped at 50.
   - Used **client-side only** to bump scores on future candidates whose phone/address/customer matches a prior override pattern (no extra AI cost).

Add helpers: `loadMatchOverrides()`, `recordMatchOverride()`, `applyMatchOverridesToScores()`.

## Files

- **edit** `src/components/ParseMessageDialog.tsx` — orchestrate parse → match → diff.
- **new** `src/components/parseMessage/MatchReviewDialog.tsx` — candidate picker.
- **new** `src/components/parseMessage/DiffPreviewDialog.tsx` — per-field diff/edit/apply.
- **new** `src/lib/jobMatching.ts` — normalize phone/address, scoring, candidate fetch.
- **new** `src/lib/jobCalc.ts` — extracted totals/cc_fee calculation (shared with `AddJobDialog`).
- **edit** `src/components/AddJobDialog.tsx` — use `jobCalc.ts` (no behavior change).
- **edit** `src/lib/aiTraining.ts` — add `matchOverrides` + helpers; bump shape; keep backward compat.

No DB migration needed. No new AI/edge-function calls beyond the existing one.

## Out of scope

- Updating `job_installations` rows from parsed text (kept in notes for now; can be a follow-up).
- Bulk apply across multiple jobs.
- Server-side fuzzy matching (kept client-side for simplicity + zero credits).
