# W9 form upload for marketers, installers and technicians

## What you get
- A **W9 form** field in the add/edit form for Marketers (Companies page), Installers and Technicians.
- Upload a PDF or a photo (photos auto-compressed). Once uploaded: **View**, **Replace** and **Remove** buttons.
- A small "W9 on file" badge in each list so you can see who is missing one.
- Only admins and managers can upload or view W9 files (they hold tax IDs).

## Technical details
- Migration: add nullable `w9_path text` column to `companies`, `installers`, `technicians`.
- New private storage bucket `w9-forms` (PDF/images, 10MB); storage.objects policies limited to admin/manager, inserts bound to `owner_id = auth.uid()`.
- New reusable `src/components/W9Field.tsx` (upload via compressImage for images, signed URL for viewing), dropped into the three forms in `companies.tsx`, `installers.tsx`, `technicians.tsx`; saves `w9_path` with the existing save call.
