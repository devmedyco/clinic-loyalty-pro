create table public.patient_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_patient_invitations_tenant
on public.patient_invitations(tenant_id, created_at desc);

create index idx_patient_invitations_patient
on public.patient_invitations(patient_id, created_at desc);

create index idx_patient_invitations_email
on public.patient_invitations(lower(email), status);

alter table public.patient_invitations enable row level security;

drop policy if exists "tenant members read patient invitations" on public.patient_invitations;
create policy "tenant members read patient invitations"
on public.patient_invitations for select to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or accepted_by = (select auth.uid())
  or (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "tenant members create patient invitations" on public.patient_invitations;
create policy "tenant members create patient invitations"
on public.patient_invitations for insert to authenticated
with check (private.has_tenant_access((select auth.uid()), tenant_id));

drop policy if exists "tenant members update patient invitations" on public.patient_invitations;
create policy "tenant members update patient invitations"
on public.patient_invitations for update to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
)
with check (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or (
    accepted_by = (select auth.uid())
    and status = 'accepted'
    and lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

grant select, insert, update on public.patient_invitations to authenticated;
