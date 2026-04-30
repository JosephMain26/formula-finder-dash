INSERT INTO public.permissions (key, label, description)
VALUES ('users.delete', 'Delete users', 'Permanently remove a user account and their role assignments')
ON CONFLICT (key) DO NOTHING;