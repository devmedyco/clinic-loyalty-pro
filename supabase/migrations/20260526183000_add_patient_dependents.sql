alter table public.tenants
  add column if not exists dependent_extra_amount numeric(12, 2) not null default 0;

alter table public.tenants
  drop constraint if exists tenants_dependent_extra_amount_non_negative,
  add constraint tenants_dependent_extra_amount_non_negative check (dependent_extra_amount >= 0);

create table if not exists public.patient_dependents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  full_name text not null,
  cpf text,
  birth_date date,
  relationship text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_dependents_tenant_patient
on public.patient_dependents(tenant_id, patient_id, status);

drop trigger if exists patient_dependents_updated_at on public.patient_dependents;
create trigger patient_dependents_updated_at
before update on public.patient_dependents
for each row execute function private.touch_updated_at();

alter table public.patient_dependents enable row level security;

drop policy if exists "patient dependents read access" on public.patient_dependents;
create policy "patient dependents read access"
on public.patient_dependents for select to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.patients p
    where p.id = patient_dependents.patient_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "tenant members manage patient dependents" on public.patient_dependents;
create policy "tenant members manage patient dependents"
on public.patient_dependents for all to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id))
with check (private.has_tenant_access((select auth.uid()), tenant_id));

grant select, insert, update, delete on public.patient_dependents to authenticated;
