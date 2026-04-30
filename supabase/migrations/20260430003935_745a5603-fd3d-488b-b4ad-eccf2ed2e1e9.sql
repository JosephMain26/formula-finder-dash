INSERT INTO public.permissions (key, label, description)
VALUES ('jobs.edit_percentage', 'Edit job percentage', 'Allowed to change the tech percentage on jobs (form override, inline edit, bulk edit)')
ON CONFLICT (key) DO NOTHING;