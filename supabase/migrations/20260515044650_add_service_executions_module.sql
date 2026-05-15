create table public.service_executions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  original_amount numeric(12, 2) not null check (original_amount >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  final_amount numeric(12, 2) not null check (final_amount >= 0),
  created_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_executions_tenant_created on public.service_executions(tenant_id, created_at desc);
create index idx_executions_patient on public.service_executions(patient_id);
create index idx_executions_service on public.service_executions(service_id);
create index idx_executions_created_by on public.service_executions(created_by);

alter table public.service_executions enable row level security;

create policy "execution read access"
on public.service_executions for select to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
);

create policy "tenant members insert executions"
on public.service_executions for insert to authenticated
with check (private.has_tenant_access((select auth.uid()), tenant_id));

grant select, insert on public.service_executions to authenticated;
