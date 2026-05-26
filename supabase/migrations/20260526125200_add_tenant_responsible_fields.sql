alter table public.tenants
  add column if not exists responsible_name text,
  add column if not exists responsible_role text;

