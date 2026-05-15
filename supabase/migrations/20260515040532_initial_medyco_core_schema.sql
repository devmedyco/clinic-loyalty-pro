create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
grant usage on schema public to anon, authenticated;

create type public.app_role as enum (
  'super_admin',
  'tenant_admin',
  'tenant_staff',
  'patient'
);

create type public.plan_tier as enum (
  'starter',
  'professional',
  'enterprise'
);

create type public.tenant_status as enum (
  'trial',
  'active',
  'paused',
  'canceled'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null,
  logo_url text,
  brand_color text,
  plan public.plan_tier not null default 'starter',
  status public.tenant_status not null default 'trial',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role, tenant_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  cpf text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, cpf)
);

create table public.benefit_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  card_number text not null unique,
  qr_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.card_validations (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.benefit_cards(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz not null default now(),
  outcome text not null default 'approved',
  notes text
);

create index idx_tenants_owner on public.tenants(owner_id);
create index idx_user_roles_user on public.user_roles(user_id);
create index idx_user_roles_tenant on public.user_roles(tenant_id);
create index idx_patients_tenant on public.patients(tenant_id);
create index idx_patients_user on public.patients(user_id);
create index idx_cards_tenant on public.benefit_cards(tenant_id);
create index idx_cards_patient on public.benefit_cards(patient_id);
create index idx_validations_card on public.card_validations(card_id);
create index idx_validations_tenant on public.card_validations(tenant_id, validated_at desc);
create index idx_validations_validated_by on public.card_validations(validated_by);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role, tenant_id)
  values (new.owner_id, 'tenant_admin', new.id)
  on conflict do nothing;
  return new;
end;
$$;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

create or replace function private.is_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(_user_id, 'super_admin');
$$;

create or replace function private.has_tenant_access(_user_id uuid, _tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and tenant_id = _tenant_id
      and role in ('tenant_admin', 'tenant_staff')
  )
  or exists (
    select 1
    from public.tenants
    where id = _tenant_id
      and owner_id = _user_id
  );
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger profiles_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create trigger tenants_updated_at
before update on public.tenants
for each row execute function private.touch_updated_at();

create trigger on_tenant_created
after insert on public.tenants
for each row execute function private.handle_new_tenant();

create trigger patients_updated_at
before update on public.patients
for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.tenants enable row level security;
alter table public.patients enable row level security;
alter table public.benefit_cards enable row level security;
alter table public.card_validations enable row level security;

create policy "users read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "users insert own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "users update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "user roles read access"
on public.user_roles for select to authenticated
using (
  (select auth.uid()) = user_id
  or private.is_super_admin((select auth.uid()))
);

create policy "tenant read access"
on public.tenants for select to authenticated
using (
  private.is_super_admin((select auth.uid()))
  or private.has_tenant_access((select auth.uid()), id)
);

create policy "authenticated creates tenant"
on public.tenants for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "owner updates tenant"
on public.tenants for update to authenticated
using ((select auth.uid()) = owner_id or private.is_super_admin((select auth.uid())))
with check ((select auth.uid()) = owner_id or private.is_super_admin((select auth.uid())));

create policy "patient read access"
on public.patients for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
);

create policy "tenant members insert patients"
on public.patients for insert to authenticated
with check (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "tenant members update patients"
on public.patients for update to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id))
with check (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "tenant members delete patients"
on public.patients for delete to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "benefit card read access"
on public.benefit_cards for select to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.patients p
    where p.id = benefit_cards.patient_id
      and p.user_id = (select auth.uid())
  )
);

create policy "tenant members insert cards"
on public.benefit_cards for insert to authenticated
with check (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "tenant members update cards"
on public.benefit_cards for update to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id))
with check (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "tenant members delete cards"
on public.benefit_cards for delete to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id));

create policy "validation read access"
on public.card_validations for select to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.benefit_cards c
    join public.patients p on p.id = c.patient_id
    where c.id = card_validations.card_id
      and p.user_id = (select auth.uid())
  )
);

create policy "tenant members create validations"
on public.card_validations for insert to authenticated
with check (private.has_tenant_access((select auth.uid()), tenant_id));

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.patients to authenticated;
grant select, insert, update, delete on public.benefit_cards to authenticated;
grant select, insert on public.card_validations to authenticated;
