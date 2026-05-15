create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  plan text not null default 'benefits',
  status text not null default 'active' check (status in ('trial', 'active', 'past_due', 'canceled', 'paused')),
  next_due_date date,
  asaas_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, patient_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_method text not null default 'manual',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  paid_at timestamptz,
  asaas_payment_id text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_subscriptions_tenant on public.subscriptions(tenant_id, status);
create index idx_subscriptions_patient on public.subscriptions(patient_id);
create index idx_payments_tenant_created on public.payments(tenant_id, created_at desc);
create index idx_payments_patient on public.payments(patient_id);
create index idx_payments_subscription on public.payments(subscription_id);

create trigger subscriptions_updated_at
before update on public.subscriptions
for each row execute function private.touch_updated_at();

alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

create policy "subscription read access"
on public.subscriptions for select to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.patients p
    where p.id = subscriptions.patient_id
      and p.user_id = (select auth.uid())
  )
);

create policy "tenant members insert subscriptions"
on public.subscriptions for insert to authenticated
with check (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "tenant members update subscriptions"
on public.subscriptions for update to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id))
with check (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "tenant members delete subscriptions"
on public.subscriptions for delete to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "payment read access"
on public.payments for select to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.patients p
    where p.id = payments.patient_id
      and p.user_id = (select auth.uid())
  )
);

create policy "tenant members insert payments"
on public.payments for insert to authenticated
with check (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "tenant members update payments"
on public.payments for update to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id))
with check (private.has_tenant_access((select auth.uid()), tenant_id));

grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update on public.payments to authenticated;
