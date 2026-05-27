-- Security and database hardening pass for production readiness.

-- Least-privilege grants. RLS still defines row access; these grants remove
-- broad anonymous table access and dangerous table-level privileges.
revoke all privileges on all tables in schema public from anon;
grant select on public.legal_documents to anon;

revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on public.asaas_webhook_events from authenticated;

-- Helper for role-specific RLS rules.
create or replace function private.has_tenant_role(
  _user_id uuid,
  _tenant_id uuid,
  _roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.is_super_admin(_user_id)
  or exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and tenant_id = _tenant_id
      and role = any(_roles)
  )
  or exists (
    select 1
    from public.tenants
    where id = _tenant_id
      and owner_id = _user_id
      and 'tenant_admin'::public.app_role = any(_roles)
  );
$$;

-- Prevent direct client-side edits to platform-controlled commercial and Asaas fields.
create or replace function private.prevent_tenant_platform_field_change()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if auth.role() = 'service_role' or private.is_super_admin(auth.uid()) then
    return new;
  end if;

  if old.plan is distinct from new.plan
    or old.status is distinct from new.status
    or old.monthly_fee is distinct from new.monthly_fee
    or old.split_fixed_fee is distinct from new.split_fixed_fee
    or old.split_percentage is distinct from new.split_percentage
    or old.commercial_model is distinct from new.commercial_model
    or old.asaas_account_id is distinct from new.asaas_account_id
    or old.asaas_wallet_id is distinct from new.asaas_wallet_id
    or old.asaas_api_key_ref is distinct from new.asaas_api_key_ref
    or old.asaas_onboarding_status is distinct from new.asaas_onboarding_status
    or old.asaas_split_enabled is distinct from new.asaas_split_enabled
    or old.asaas_saas_customer_id is distinct from new.asaas_saas_customer_id
    or old.asaas_saas_subscription_id is distinct from new.asaas_saas_subscription_id
    or old.saas_billing_status is distinct from new.saas_billing_status
    or old.saas_billing_type is distinct from new.saas_billing_type
    or old.saas_next_due_date is distinct from new.saas_next_due_date
    or old.saas_invoice_url is distinct from new.saas_invoice_url
    or old.saas_last_payment_id is distinct from new.saas_last_payment_id
    or old.saas_started_at is distinct from new.saas_started_at
    or old.saas_canceled_at is distinct from new.saas_canceled_at
    or old.saas_billing_error is distinct from new.saas_billing_error
  then
    raise exception 'Platform-controlled tenant fields can only be changed by a super admin';
  end if;

  return new;
end;
$$;

drop trigger if exists tenants_platform_field_guard on public.tenants;
create trigger tenants_platform_field_guard
before update on public.tenants
for each row execute function private.prevent_tenant_platform_field_change();

-- Prevent tenant users from changing invitation identity fields after creation.
create or replace function private.prevent_patient_invite_identity_change()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if auth.role() = 'service_role' or private.is_super_admin(auth.uid()) then
    return new;
  end if;

  if old.tenant_id is distinct from new.tenant_id
    or old.patient_id is distinct from new.patient_id
    or old.email is distinct from new.email
    or old.token is distinct from new.token
    or old.invited_by is distinct from new.invited_by
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Patient invitation identity fields cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists patient_invitations_identity_guard on public.patient_invitations;
create trigger patient_invitations_identity_guard
before update on public.patient_invitations
for each row execute function private.prevent_patient_invite_identity_change();

-- Avoid duplicate global roles with null tenant_id.
create unique index if not exists user_roles_global_unique_idx
on public.user_roles (user_id, role)
where tenant_id is null;

-- Cover foreign keys flagged by Supabase advisor.
create index if not exists legal_acceptances_user_id_idx on public.legal_acceptances(user_id);
create index if not exists notifications_patient_id_idx on public.notifications(patient_id);
create index if not exists operational_events_actor_user_id_idx on public.operational_events(actor_user_id);
create index if not exists patient_dependents_patient_id_idx on public.patient_dependents(patient_id);
create index if not exists patient_invitations_accepted_by_idx on public.patient_invitations(accepted_by);
create index if not exists patient_invitations_invited_by_idx on public.patient_invitations(invited_by);
create index if not exists provider_services_tenant_id_idx on public.provider_services(tenant_id);
create index if not exists staff_invitations_accepted_by_idx on public.staff_invitations(accepted_by);
create index if not exists staff_invitations_invited_by_idx on public.staff_invitations(invited_by);
create index if not exists user_roles_tenant_id_idx on public.user_roles(tenant_id);

-- Tighten public provider visibility to the patient's own tenant.
drop policy if exists "provider read access" on public.providers;
drop policy if exists "tenant members manage providers" on public.providers;

create policy "provider read access"
on public.providers
for select
to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or (
    active = true
    and exists (
      select 1
      from public.patients p
      where p.tenant_id = providers.tenant_id
        and p.user_id = (select auth.uid())
    )
  )
);

create policy "tenant admins insert providers"
on public.providers
for insert
to authenticated
with check (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
);

create policy "tenant admins update providers"
on public.providers
for update
to authenticated
using (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
)
with check (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
);

create policy "tenant admins delete providers"
on public.providers
for delete
to authenticated
using (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
);

drop policy if exists "provider service read access" on public.provider_services;
drop policy if exists "tenant members manage provider services" on public.provider_services;

create policy "provider service read access"
on public.provider_services
for select
to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.patients p
    where p.tenant_id = provider_services.tenant_id
      and p.user_id = (select auth.uid())
  )
);

create policy "tenant admins insert provider services"
on public.provider_services
for insert
to authenticated
with check (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
);

create policy "tenant admins update provider services"
on public.provider_services
for update
to authenticated
using (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
)
with check (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
);

create policy "tenant admins delete provider services"
on public.provider_services
for delete
to authenticated
using (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
);

-- Remove duplicate permissive SELECT policies and make role intent explicit.
drop policy if exists "patient dependents read access" on public.patient_dependents;
drop policy if exists "tenant members manage patient dependents" on public.patient_dependents;

create policy "patient dependents read access"
on public.patient_dependents
for select
to authenticated
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

create policy "tenant members insert patient dependents"
on public.patient_dependents
for insert
to authenticated
with check (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin','tenant_staff']::public.app_role[]
  )
);

create policy "tenant members update patient dependents"
on public.patient_dependents
for update
to authenticated
using (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin','tenant_staff']::public.app_role[]
  )
)
with check (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin','tenant_staff']::public.app_role[]
  )
);

create policy "tenant members delete patient dependents"
on public.patient_dependents
for delete
to authenticated
using (
  private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin','tenant_staff']::public.app_role[]
  )
);

drop policy if exists "tenant members read peer profiles" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;

create policy "profile read access"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.is_super_admin((select auth.uid()))
  or exists (
    select 1
    from public.user_roles cr
    join public.user_roles peer_role on peer_role.tenant_id = cr.tenant_id
    where cr.user_id = (select auth.uid())
      and cr.role in ('tenant_admin','tenant_staff')
      and peer_role.user_id = profiles.id
      and peer_role.role in ('tenant_admin','tenant_staff')
  )
);

drop policy if exists "Super admins can read operational events" on public.operational_events;
drop policy if exists "Tenant admins can read own operational events" on public.operational_events;
drop policy if exists "Tenant members can insert own operational events" on public.operational_events;

create policy "operational event read access"
on public.operational_events
for select
to authenticated
using (
  private.is_super_admin((select auth.uid()))
  or (
    tenant_id is not null
    and private.has_tenant_role(
      (select auth.uid()),
      tenant_id,
      array['tenant_admin']::public.app_role[]
    )
  )
);

create policy "operational event insert access"
on public.operational_events
for insert
to authenticated
with check (
  private.is_super_admin((select auth.uid()))
  or (
    tenant_id is not null
    and private.has_tenant_role(
      (select auth.uid()),
      tenant_id,
      array['tenant_admin','tenant_staff']::public.app_role[]
    )
  )
);

-- Make invitation policies planner-friendly and explicit.
drop policy if exists "tenant members invite read access" on public.staff_invitations;
drop policy if exists "tenant admins update invitations" on public.staff_invitations;

create policy "tenant members invite read access"
on public.staff_invitations
for select
to authenticated
using (
  private.is_super_admin((select auth.uid()))
  or private.has_tenant_access((select auth.uid()), tenant_id)
  or (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
);

create policy "tenant admins update invitations"
on public.staff_invitations
for update
to authenticated
using (
  private.is_super_admin((select auth.uid()))
  or private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
  or (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
)
with check (
  private.is_super_admin((select auth.uid()))
  or private.has_tenant_role(
    (select auth.uid()),
    tenant_id,
    array['tenant_admin']::public.app_role[]
  )
  or (
    accepted_by = (select auth.uid())
    and status = 'accepted'
    and lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
);

drop policy if exists "tenant members read patient invitations" on public.patient_invitations;
drop policy if exists "tenant members update patient invitations" on public.patient_invitations;

create policy "tenant members read patient invitations"
on public.patient_invitations
for select
to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or accepted_by = (select auth.uid())
  or (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
);

create policy "tenant members update patient invitations"
on public.patient_invitations
for update
to authenticated
using (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
)
with check (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or (
    accepted_by = (select auth.uid())
    and status = 'accepted'
    and lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
);

drop policy if exists "invited users accept tenant roles" on public.user_roles;

create policy "invited users accept tenant roles"
on public.user_roles
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role in ('tenant_admin','tenant_staff')
  and tenant_id is not null
  and exists (
    select 1
    from public.staff_invitations si
    where si.tenant_id = user_roles.tenant_id
      and si.role = user_roles.role
      and si.status = 'pending'
      and si.expires_at > now()
      and lower(si.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  )
);

-- Storage policy tightening. Keep buckets public for current publicUrl UX, but
-- prevent super admins from accidentally writing outside the intended bucket.
drop policy if exists "tenant members upload tenant assets" on storage.objects;
drop policy if exists "tenant members update tenant assets" on storage.objects;
drop policy if exists "tenant members delete tenant assets" on storage.objects;
drop policy if exists "users delete own avatars" on storage.objects;

create policy "tenant members upload tenant assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tenant-assets'
  and (
    private.has_tenant_access(
      (select auth.uid()),
      private.uuid_or_null((storage.foldername(name))[1])
    )
    or private.is_super_admin((select auth.uid()))
  )
);

create policy "tenant members update tenant assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tenant-assets'
  and (
    private.has_tenant_access(
      (select auth.uid()),
      private.uuid_or_null((storage.foldername(name))[1])
    )
    or private.is_super_admin((select auth.uid()))
  )
)
with check (
  bucket_id = 'tenant-assets'
  and (
    private.has_tenant_access(
      (select auth.uid()),
      private.uuid_or_null((storage.foldername(name))[1])
    )
    or private.is_super_admin((select auth.uid()))
  )
);

create policy "tenant members delete tenant assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tenant-assets'
  and (
    private.has_tenant_access(
      (select auth.uid()),
      private.uuid_or_null((storage.foldername(name))[1])
    )
    or private.is_super_admin((select auth.uid()))
  )
);

create policy "users delete own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
