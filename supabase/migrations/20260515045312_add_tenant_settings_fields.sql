alter table public.tenants
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists cnpj text,
  add column if not exists settings jsonb not null default '{}'::jsonb;
