alter table public.tenants
  add column if not exists split_fixed_fee numeric(12, 2) not null default 2.90;

alter table public.tenants
  alter column split_percentage set default 7.90;

alter table public.tenants
  drop constraint if exists tenants_split_fixed_fee_non_negative,
  drop constraint if exists tenants_commercial_model_check;

alter table public.tenants
  add constraint tenants_split_fixed_fee_non_negative check (split_fixed_fee >= 0),
  add constraint tenants_commercial_model_check
    check (commercial_model in ('base_plus_split', 'base_fixed_plus_split', 'custom'));

update public.tenants
set
  split_fixed_fee = 2.90,
  split_percentage = 7.90,
  commercial_model = 'base_fixed_plus_split'
where commercial_model = 'base_plus_split'
  and split_percentage = 10.00;

alter table public.payments
  add column if not exists asaas_split_fixed_fee numeric(12, 2);
