-- Add 'tech' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tech';

-- New permission keys
INSERT INTO public.permissions (key, label, description) VALUES
  ('jobs.add_for_others', 'Add jobs for other techs', 'When OFF, the user may only create jobs assigned to themselves'),
  ('marketer.view_percentage', 'View marketer percentage', 'Allows seeing the marketer % field in job form / table')
ON CONFLICT (key) DO NOTHING;

-- Default permissions for tech role (role_name is TEXT, safe in same migration)
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('tech', 'jobs.view'),
  ('tech', 'jobs.add'),
  ('tech', 'jobs.edit')
ON CONFLICT DO NOTHING;

-- Default: admin and manager can see marketer percentage and add jobs for others
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('admin', 'jobs.add_for_others'),
  ('admin', 'marketer.view_percentage'),
  ('manager', 'jobs.add_for_others'),
  ('manager', 'marketer.view_percentage')
ON CONFLICT DO NOTHING;