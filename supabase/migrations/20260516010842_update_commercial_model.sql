alter table public.tenants
  add column if not exists monthly_fee numeric(12, 2) not null default 197.00,
  add column if not exists split_percentage numeric(5, 2) not null default 10.00,
  add column if not exists commercial_model text not null default 'base_plus_split',
  add column if not exists patient_subscription_suggestion numeric(12, 2) not null default 39.90;

alter table public.tenants
  drop constraint if exists tenants_monthly_fee_non_negative,
  drop constraint if exists tenants_split_percentage_range,
  drop constraint if exists tenants_patient_subscription_suggestion_non_negative,
  drop constraint if exists tenants_commercial_model_check;

alter table public.tenants
  add constraint tenants_monthly_fee_non_negative check (monthly_fee >= 0),
  add constraint tenants_split_percentage_range check (split_percentage >= 0 and split_percentage <= 100),
  add constraint tenants_patient_subscription_suggestion_non_negative check (patient_subscription_suggestion >= 0),
  add constraint tenants_commercial_model_check check (commercial_model in ('base_plus_split', 'custom'));
