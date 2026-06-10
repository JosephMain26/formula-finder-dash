# One-Click PDF Handbook Download

Add a one-click download button for the generated Application Reference Handbook PDF, placed in a new admin-only **Help** tab on the Settings page.

## What you'll get
- A new **Help** tab in Settings (admin-only, matching the existing Settings access control).
- A clean card with a short description and a **Download Handbook (PDF)** button.
- Clicking the button instantly downloads the PDF — no generation wait, no extra steps.

## How it works (technical)

```text
public/app-reference-handbook.pdf   ← PDF served as a static asset
        │
        ▼
Settings → Help tab → "Download Handbook (PDF)" button (anchor with download attr)
```

### Steps
1. **Serve the PDF as a static asset.** Copy the already-generated `app-reference-handbook.pdf` into the project's `public/` folder so the app can serve it at `/app-reference-handbook.pdf`. This is the lightest-weight approach — no backend, no storage bucket, no credits to generate on demand.
2. **Add a Help tab to `src/routes/settings.tsx`.**
   - Add a new `<TabsTrigger value="help">` (with a `FileText` icon) to the existing `TabsList`.
   - Add a matching `<TabsContent value="help">` containing a `Card` with a title ("Documentation"), a one-line description, and a download button.
   - The button is a styled anchor: `<a href="/app-reference-handbook.pdf" download>` wrapped to look like the app's primary `Button` (using `buttonVariants`), with a `Download` icon.
   - Access stays admin-only automatically — the whole Settings page already redirects non-admins to `/`.

## Notes
- No database, RLS, or backend changes.
- If the handbook content changes later, regenerating the PDF and replacing the file in `public/` keeps the same download link working.
- Only `src/routes/settings.tsx` is edited; one static file is added.
