alter table public.user_roles
  drop constraint if exists user_roles_tenant_id_fkey,
  add constraint user_roles_tenant_id_fkey
    foreign key (tenant_id)
    references public.tenants(id)
    on delete cascade;
