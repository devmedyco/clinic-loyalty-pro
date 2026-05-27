create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  scope text not null default 'platform',
  level text not null default 'info',
  event_type text not null,
  title text not null,
  detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint operational_events_scope_check check (
    scope in ('platform', 'tenant', 'billing', 'auth', 'support')
  ),
  constraint operational_events_level_check check (level in ('info', 'warning', 'error'))
);

create index if not exists operational_events_created_at_idx
  on public.operational_events (created_at desc);

create index if not exists operational_events_tenant_created_at_idx
  on public.operational_events (tenant_id, created_at desc);

create index if not exists operational_events_level_created_at_idx
  on public.operational_events (level, created_at desc);

create index if not exists operational_events_event_type_created_at_idx
  on public.operational_events (event_type, created_at desc);

alter table public.operational_events enable row level security;

drop policy if exists "Super admins can read operational events" on public.operational_events;
create policy "Super admins can read operational events"
on public.operational_events
for select
to authenticated
using (private.is_super_admin(auth.uid()));

drop policy if exists "Tenant admins can read own operational events" on public.operational_events;
create policy "Tenant admins can read own operational events"
on public.operational_events
for select
to authenticated
using (
  tenant_id is not null
  and private.has_tenant_access((select auth.uid()), tenant_id)
);

drop policy if exists "Tenant members can insert own operational events" on public.operational_events;
create policy "Tenant members can insert own operational events"
on public.operational_events
for insert
to authenticated
with check (
  private.is_super_admin(auth.uid())
  or (
    tenant_id is not null
    and private.has_tenant_access((select auth.uid()), tenant_id)
  )
);
