drop policy if exists "service read access" on public.services;
create policy "service read access"
on public.services for select to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or (
    active = true
    and exists (
      select 1
      from public.patients p
      where p.tenant_id = services.tenant_id
        and p.user_id = (select auth.uid())
    )
  )
);
