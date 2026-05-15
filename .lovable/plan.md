## Goal
Fix the broken post-submit client popup on mobile, and add lightweight address validation so saved jobs with valid addresses appear in the map widget while incorrect addresses prompt a correction suggestion.

## What I’ll change

### 1) Fix the mobile “Save Client Details” popup reliably
Update `src/components/AddJobDialog.tsx` so the follow-up client popup is not owned by a dialog subtree that gets closed/unmounted first.

- Keep the add-job dialog open long enough for the client prompt decision path, instead of closing it first and trying to open a second dialog later.
- Replace the nested follow-up popup with an explicit mobile-safe confirmation flow that survives both:
  - direct Add Job from dashboard
  - parsed-message flow where `JobDialog` is controlled by a parent dialog
- Ensure the popup/container uses phone-safe sizing and scroll behavior.

Why this is needed:
- The current code closes `JobDialog` before opening the client popup.
- In controlled/mobile flows, that unmounts the component holding `showNewClientPopup`, so the popup never appears.

### 2) Add address validation/correction on job submit
Add a small frontend-only address check before inserting a job when an address is present.

Behavior:
- If the address geocodes cleanly, submit normally.
- If the address does not geocode, try a lightweight normalized/corrected lookup.
- If a likely corrected address is found, ask the user:
  - “Did you mean this address instead?”
  - allow **Use suggested address** or **Keep original**
- If no suggestion is found, allow the user to continue with their original address.

Scope:
- Main `AddJobDialog` flow
- Remote `/upload` manual submit flow
- Remote `/upload` parse-review submit flow

### 3) Make map widget pick up new valid-address jobs immediately
Keep the map behavior simple and cheap:
- reuse the existing geocoding cache flow in `src/lib/databoard/geocode.ts`
- normalize addresses consistently before lookup so newly saved jobs are more likely to resolve
- do not add backend services or paid APIs

This ensures a valid submitted address can appear as a pin in the map widget once the jobs list/databoard refreshes.

## Files likely to change
- `src/components/AddJobDialog.tsx`
- `src/routes/upload.tsx`
- `src/lib/databoard/geocode.ts`
- possibly one shared UI dialog file only if needed for the address suggestion prompt

## Technical details
- Extract a shared address helper that:
  - trims/normalizes input
  - attempts primary geocode
  - attempts a fallback normalized query
  - returns `{ resolved, suggestion, coordinates }`
- Use a confirmation modal/dialog before final insert when there is an address ambiguity.
- Refactor `AddJobDialog` submit flow so the client-save prompt is handled before the component is torn down.
- Preserve existing business logic for job creation, client linking, and map rendering.

## Validation
- Reproduce on phone viewport:
  1. Add job with client mode = New
  2. Submit
  3. Confirm the client popup appears and is usable
- Verify same flow from parsed-message path
- Submit a job with a valid address and confirm the map widget can resolve/show a pin after refresh
- Submit a job with a bad address and confirm the correction prompt appears
- Confirm desktop behavior still works