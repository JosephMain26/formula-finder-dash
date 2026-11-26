# W9 auto-fill + split screen + SSN/EIN

## What you'll get
- Upload a W9 in the Add/Edit form for Marketers, Installers, or Technicians, and the AI reads it and fills in name, business name, address, email/phone (if on the form), and the SSN or EIN.
- After you upload a W9, the form opens a split screen on desktop: the W9 on the left and the form on the right, so you can check each field. On phones, the W9 shows above the form and you can collapse it.
- A new **SSN / EIN** field on all three forms, with a type choice (SSN or EIN). It's hidden in lists (only the last 4 digits show) and only admins and managers can see it.
- Auto-fill only fills empty fields, so it never overwrites anything you've already typed. A message tells you which fields were filled.

## Technical details
- Migration: add `tax_id_type text` and `tax_id text` to companies, installers, technicians (nullable). Existing admin/manager policies cover them; revoke anon SELECT on the new columns.
- New `src/lib/w9Ai.functions.ts`: an authenticated server function takes the storage path, loads the file through the user's client (RLS), and sends it to Lovable AI (gemini-2.5-flash, the same pattern as expenseAi) with a tool schema {name, business_name, address, city, state, zip, tax_id_type, tax_id}.
- W9Field gets an `onParsed(data)` callback and an `onPreview(url)` callback, and calls parse after upload. There's also a "Re-read W9" button.
- Each of the three dialogs widens to `max-w-5xl` when a preview URL exists, using a `md:grid-cols-2` layout: an iframe/img of the W9 next to the existing form fields. Empty-field merge is done in each page's handler.
