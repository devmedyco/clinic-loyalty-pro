create or replace function private.has_tenant_access(_user_id uuid, _tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin(_user_id)
  or exists (
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
