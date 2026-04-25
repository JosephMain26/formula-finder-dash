
-- Add DataBoard permissions
INSERT INTO public.permissions (key, label, description) VALUES
  ('databoard.view', 'View DataBoard', 'Access the DataBoard analytics page'),
  ('databoard.view_all', 'View all data on DataBoard', 'See data for all users (not just own)'),
  ('databoard.edit_layout', 'Edit DataBoard layout', 'Add, remove, drag and resize widgets')
ON CONFLICT (key) DO NOTHING;

-- Grant to roles
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('manager', 'databoard.view'),
  ('manager', 'databoard.view_all'),
  ('manager', 'databoard.edit_layout'),
  ('user', 'databoard.view'),
  ('user', 'databoard.view_all'),
  ('user', 'databoard.edit_layout'),
  ('tech', 'databoard.view'),
  ('marketer', 'databoard.view')
ON CONFLICT DO NOTHING;
