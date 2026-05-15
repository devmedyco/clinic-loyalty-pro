create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.app_role not null check (role in ('tenant_admin', 'tenant_staff')),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_staff_invitations_tenant on public.staff_invitations(tenant_id, created_at desc);
create index idx_staff_invitations_email on public.staff_invitations(lower(email));
create index idx_staff_invitations_status on public.staff_invitations(tenant_id, status);

create unique index idx_staff_invitations_pending_email
on public.staff_invitations(tenant_id, lower(email))
where status = 'pending';

alter table public.staff_invitations enable row level security;

create or replace function private.prevent_invite_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.email is distinct from new.email
    or old.role is distinct from new.role
    or old.tenant_id is distinct from new.tenant_id
    or old.token is distinct from new.token
    or old.invited_by is distinct from new.invited_by
    or old.created_at is distinct from new.created_at
  then
    if not private.is_super_admin(auth.uid())
      and not exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.tenant_id = old.tenant_id
          and ur.role = 'tenant_admin'
      )
    then
      raise exception 'Invitation identity fields cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

create trigger staff_invitations_identity_guard
before update on public.staff_invitations
for each row execute function private.prevent_invite_identity_change();

drop policy if exists "user roles read access" on public.user_roles;
create policy "user roles read access"
on public.user_roles for select to authenticated
using (
  (select auth.uid()) = user_id
  or private.is_super_admin((select auth.uid()))
  or (
    tenant_id is not null
    and private.has_tenant_access((select auth.uid()), tenant_id)
  )
);

create policy "tenant members read peer profiles"
on public.profiles for select to authenticated
using (
  private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.user_roles cr
    join public.user_roles peer_role
      on peer_role.tenant_id = cr.tenant_id
    where cr.user_id = (select auth.uid())
      and cr.role in ('tenant_admin', 'tenant_staff')
      and peer_role.user_id = profiles.id
      and peer_role.role in ('tenant_admin', 'tenant_staff')
  )
);

create policy "tenant members invite read access"
on public.staff_invitations for select to authenticated
using (
  private.is_super_admin((select auth.uid()))
  or private.has_tenant_access((select auth.uid()), tenant_id)
  or (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create policy "tenant admins create invitations"
on public.staff_invitations for insert to authenticated
with check (
  invited_by = (select auth.uid())
  and role in ('tenant_admin', 'tenant_staff')
  and (
    private.is_super_admin((select auth.uid()))
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.tenant_id = staff_invitations.tenant_id
        and ur.role = 'tenant_admin'
    )
  )
);

create policy "tenant admins update invitations"
on public.staff_invitations for update to authenticated
using (
  private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.tenant_id = staff_invitations.tenant_id
      and ur.role = 'tenant_admin'
  )
  or (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
)
with check (
  private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.tenant_id = staff_invitations.tenant_id
      and ur.role = 'tenant_admin'
  )
  or (
    accepted_by = (select auth.uid())
    and status = 'accepted'
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

create policy "tenant admins delete invitations"
on public.staff_invitations for delete to authenticated
using (
  private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.tenant_id = staff_invitations.tenant_id
      and ur.role = 'tenant_admin'
  )
);

create policy "invited users accept tenant roles"
on public.user_roles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role in ('tenant_admin', 'tenant_staff')
  and tenant_id is not null
  and exists (
    select 1
    from public.staff_invitations si
    where si.tenant_id = user_roles.tenant_id
      and si.role = user_roles.role
      and si.status = 'pending'
      and si.expires_at > now()
      and lower(si.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

grant select, insert, update, delete on public.staff_invitations to authenticated;
grant insert on public.user_roles to authenticated;
