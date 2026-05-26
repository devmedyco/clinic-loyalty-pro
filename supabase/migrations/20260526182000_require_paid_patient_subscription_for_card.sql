update public.subscriptions s
set
  status = 'past_due',
  updated_at = now()
where s.status in ('active', 'trial')
  and not exists (
    select 1
    from public.payments p
    where p.tenant_id = s.tenant_id
      and p.patient_id = s.patient_id
      and p.subscription_id = s.id
      and p.status = 'paid'
  );
