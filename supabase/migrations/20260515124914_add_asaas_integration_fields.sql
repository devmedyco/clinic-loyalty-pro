alter table public.patients
  add column if not exists asaas_customer_id text;

alter table public.payments
  add column if not exists due_date date,
  add column if not exists confirmed_at timestamptz,
  add column if not exists asaas_invoice_url text,
  add column if not exists asaas_bank_slip_url text,
  add column if not exists asaas_pix_payload text;

create table if not exists public.asaas_webhook_events (
  id text primary key,
  event text not null,
  asaas_payment_id text,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create index if not exists idx_patients_asaas_customer_id
on public.patients(asaas_customer_id)
where asaas_customer_id is not null;

create index if not exists idx_payments_asaas_payment_id
on public.payments(asaas_payment_id)
where asaas_payment_id is not null;

create index if not exists idx_payments_due_date
on public.payments(tenant_id, due_date)
where due_date is not null;

create index if not exists idx_asaas_webhook_events_payment
on public.asaas_webhook_events(asaas_payment_id)
where asaas_payment_id is not null;

alter table public.asaas_webhook_events enable row level security;

drop policy if exists "super admins read asaas webhooks" on public.asaas_webhook_events;
create policy "super admins read asaas webhooks"
on public.asaas_webhook_events for select to authenticated
using (private.is_super_admin((select auth.uid())));

grant select on public.asaas_webhook_events to authenticated;
