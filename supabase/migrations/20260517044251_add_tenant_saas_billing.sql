alter table public.tenants
  add column if not exists asaas_saas_customer_id text,
  add column if not exists asaas_saas_subscription_id text,
  add column if not exists saas_billing_status text not null default 'not_started',
  add column if not exists saas_billing_type text not null default 'PIX',
  add column if not exists saas_next_due_date date,
  add column if not exists saas_invoice_url text,
  add column if not exists saas_last_payment_id text,
  add column if not exists saas_started_at timestamptz,
  add column if not exists saas_canceled_at timestamptz,
  add column if not exists saas_billing_error text;

alter table public.tenants
  drop constraint if exists tenants_saas_billing_status_check,
  add constraint tenants_saas_billing_status_check
    check (saas_billing_status in (
      'not_started',
      'pending',
      'active',
      'overdue',
      'canceled',
      'failed'
    ));

alter table public.tenants
  drop constraint if exists tenants_saas_billing_type_check,
  add constraint tenants_saas_billing_type_check
    check (saas_billing_type in ('PIX', 'BOLETO', 'CREDIT_CARD'));

create index if not exists idx_tenants_asaas_saas_customer_id
on public.tenants(asaas_saas_customer_id)
where asaas_saas_customer_id is not null;

create index if not exists idx_tenants_asaas_saas_subscription_id
on public.tenants(asaas_saas_subscription_id)
where asaas_saas_subscription_id is not null;
