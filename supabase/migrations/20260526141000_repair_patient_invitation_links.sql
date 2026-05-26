update public.patients p
set user_id = pi.accepted_by
from public.patient_invitations pi
join auth.users u
  on u.id = pi.accepted_by
 and lower(u.email) = lower(pi.email)
where pi.patient_id = p.id
  and pi.tenant_id = p.tenant_id
  and pi.status = 'accepted'
  and pi.accepted_by is not null
  and (p.user_id is null or p.user_id = pi.accepted_by);

insert into public.user_roles (user_id, tenant_id, role)
select pi.accepted_by, pi.tenant_id, 'patient'::public.app_role
from public.patient_invitations pi
join public.patients p
  on p.id = pi.patient_id
 and p.tenant_id = pi.tenant_id
join auth.users u
  on u.id = pi.accepted_by
 and lower(u.email) = lower(pi.email)
where pi.status = 'accepted'
  and pi.accepted_by is not null
  and p.user_id = pi.accepted_by
on conflict do nothing;
