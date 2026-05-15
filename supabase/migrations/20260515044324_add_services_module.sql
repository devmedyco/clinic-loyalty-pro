create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  original_price numeric(12, 2) not null check (original_price >= 0),
  discount_percentage numeric(5, 2) not null default 0 check (discount_percentage >= 0 and discount_percentage <= 100),
  final_price numeric(12, 2) not null check (final_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_services_tenant on public.services(tenant_id);
create index idx_services_tenant_active on public.services(tenant_id, active);

create trigger services_updated_at
before update on public.services
for each row execute function private.touch_updated_at();

alter table public.services enable row level security;

create policy "service read access"
on public.services for select to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
);

create policy "tenant members insert services"
on public.services for insert to authenticated
with check (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "tenant members update services"
on public.services for update to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id))
with check (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "tenant members delete services"
on public.services for delete to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id));

grant select, insert, update, delete on public.services to authenticated;
