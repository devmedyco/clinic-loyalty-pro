alter table public.legal_documents
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.legal_documents
  drop constraint if exists legal_documents_type_version_key;

create unique index if not exists legal_documents_global_type_version_key
on public.legal_documents(type, version)
where tenant_id is null;

create unique index if not exists legal_documents_tenant_type_version_key
on public.legal_documents(tenant_id, type, version)
where tenant_id is not null;

create index if not exists idx_legal_documents_tenant_active
on public.legal_documents(tenant_id, type, active, created_at desc);

drop policy if exists "active legal documents are readable" on public.legal_documents;
drop policy if exists "public reads global active legal documents" on public.legal_documents;
create policy "public reads global active legal documents"
on public.legal_documents for select to anon
using (tenant_id is null and active = true);

drop policy if exists "authenticated legal document read access" on public.legal_documents;
create policy "authenticated legal document read access"
on public.legal_documents for select to authenticated
using (
  tenant_id is null
  or private.is_super_admin((select auth.uid()))
  or private.has_tenant_access((select auth.uid()), tenant_id)
  or exists (
    select 1
    from public.patients p
    where p.tenant_id = legal_documents.tenant_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "tenant members create legal documents" on public.legal_documents;
create policy "tenant members create legal documents"
on public.legal_documents for insert to authenticated
with check (
  tenant_id is not null
  and private.has_tenant_access((select auth.uid()), tenant_id)
);

drop policy if exists "tenant members update legal documents" on public.legal_documents;
create policy "tenant members update legal documents"
on public.legal_documents for update to authenticated
using (
  tenant_id is not null
  and private.has_tenant_access((select auth.uid()), tenant_id)
)
with check (
  tenant_id is not null
  and private.has_tenant_access((select auth.uid()), tenant_id)
);

drop policy if exists "patients accept own legal documents" on public.legal_acceptances;
create policy "patients accept own legal documents"
on public.legal_acceptances for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.patients p
    where p.id = legal_acceptances.patient_id
      and p.tenant_id = legal_acceptances.tenant_id
      and p.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.legal_documents d
    where d.id = legal_acceptances.document_id
      and d.active = true
      and (d.tenant_id is null or d.tenant_id = legal_acceptances.tenant_id)
  )
);

grant select, insert, update on public.legal_documents to authenticated;
