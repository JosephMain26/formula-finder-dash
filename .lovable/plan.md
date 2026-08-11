# Estimates & Invoices

Add a document system for estimates and invoices, with client e-signature approval, conversion to invoice, flexible discounts, and links to jobs.

## What you'll get

**New "Billing" page** (`/billing`) with two tabs: Estimates and Invoices.
- List view: number, client, job link, date, total, status badge (Draft / Sent / Approved / Declined / Invoiced · Unpaid / Paid), search + status filter.
- Editor dialog: pick client (existing clients list), optional linked job, line items (description, qty, unit price), notes/terms, tax rate.

**Line items and discounts**
- Per-item discount: fixed amount or percentage.
- Document-level discounts: add multiple discounts, each fixed or percentage, each with a label.
- Live totals: subtotal → item discounts → document discounts (applied in order) → tax → total.

**Approval of an estimate — two paths**
1. Manual approve: one button, records who approved and when.
2. Send to client: generates a unique public link (emailed, or copy the link). Client opens a clean read-only estimate page, types their full name, draws a signature on a canvas, and submits.
   - On signing we capture: full name, signature image, IP address, date/time, and device/browser (user agent).
   - Those details are then shown on the estimate (a "Signed by" block with the signature image and the audit line) for you and on the printable view.
   - Link can be expired/revoked; already-signed links show the signed state instead of the form.

**Convert to invoice**
- Approved estimate gets a "Convert to invoice" button: copies client, job link, items and discounts into a new invoice, marks the estimate as Invoiced, and keeps a reference both ways.
- Invoices track paid/unpaid, amount paid, and payment method.

**Job linking**
- In the job form (Add/Edit Job), a "Billing" line lets you attach an existing estimate or invoice, or create one from the job (prefills client and price).
- On the billing document, the linked job is shown with a link back to it.

**Print / PDF**
- Both estimates and invoices get a print-friendly view (browser Print → Save as PDF) including the signature block.

## Technical notes

Database (one migration):
- `billing_documents` — kind (estimate/invoice), number (auto sequence per kind), client_id, job_id, status, issue_date, due_date, tax_rate, notes/terms, discounts jsonb (array of {label, type, value}), totals (subtotal, discount_total, tax_total, total), approval fields (approved_by, approved_at, approval_mode), signature fields (signer_name, signature_data_url, signed_ip, signed_at, signed_user_agent), converted_from/converted_to, created_by. Plus `share_token`, `share_expires_at`.
- `billing_items` — document_id, description, qty, unit_price, discount_type, discount_value, sort_order.
- GRANTs for authenticated/service_role, RLS scoped to authenticated users (same visibility model as jobs), `updated_at` triggers. Signing is performed by a server function using service role after validating the token, so no anon table access is granted.
- `jobs` gets no schema change; the link lives on the document (`job_id`), and the job form reads/writes it.

Code:
- `src/lib/billing.ts` — types, totals math (single shared function used by editor, list, and public view), CRUD.
- `src/lib/billing.functions.ts` — server functions: `getPublicDocument({token})` (read-only projection, no internal fields) and `signDocument({token, fullName, signature})` which reads IP from request headers (`cf-connecting-ip` / `x-forwarded-for`) and user agent server-side, so the client can't spoof them; writes with the admin client after token validation.
- `src/routes/billing.tsx` — page + tabs; `src/components/billing/*` — DocumentEditorDialog, DocumentList, DocumentView, DiscountEditor, LineItemsEditor, SignaturePad (small canvas component, no new dependency).
- `src/routes/sign.$token.tsx` — public route (top-level, SSR, no auth gate) for the client-facing signing page.
- Email of the estimate link reuses the existing transactional email path already used by report automations.
- Nav entry added to the desktop nav and `MobileNav`.

## Not included (say the word and I'll add)
- Online payment collection on invoices.
- Recurring invoices or partial payment schedules.
