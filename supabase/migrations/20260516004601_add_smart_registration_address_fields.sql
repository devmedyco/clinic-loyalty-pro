alter table public.tenants
  add column if not exists legal_name text,
  add column if not exists zip_code text,
  add column if not exists street text,
  add column if not exists number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text;

alter table public.patients
  add column if not exists birth_date date,
  add column if not exists zip_code text,
  add column if not exists street text,
  add column if not exists number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text;

create index if not exists idx_tenants_cnpj on public.tenants(cnpj) where cnpj is not null;
create index if not exists idx_patients_cpf on public.patients(cpf) where cpf is not null;
create index if not exists idx_patients_location on public.patients(tenant_id, city, state);
