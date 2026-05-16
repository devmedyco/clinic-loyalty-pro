alter table public.tenants
  add column if not exists asaas_account_id text,
  add column if not exists asaas_wallet_id text,
  add column if not exists asaas_api_key_ref text,
  add column if not exists asaas_onboarding_status text not null default 'not_started',
  add column if not exists asaas_split_enabled boolean not null default true;

alter table public.payments
  add column if not exists asaas_split_wallet_id text,
  add column if not exists asaas_split_percentage numeric(5, 2),
  add column if not exists asaas_split_status text,
  add column if not exists asaas_net_value numeric(12, 2),
  add column if not exists asaas_split_value numeric(12, 2);

alter table public.tenants
  drop constraint if exists tenants_asaas_onboarding_status_check;

alter table public.tenants
  add constraint tenants_asaas_onboarding_status_check
  check (
    asaas_onboarding_status in (
      'not_started',
      'pending_documents',
      'under_review',
      'active',
      'rejected',
      'disabled'
    )
  );

create index if not exists idx_tenants_asaas_account
on public.tenants(asaas_account_id)
where asaas_account_id is not null;

create index if not exists idx_tenants_asaas_wallet
on public.tenants(asaas_wallet_id)
where asaas_wallet_id is not null;
