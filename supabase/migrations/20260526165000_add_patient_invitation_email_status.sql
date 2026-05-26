alter table public.patient_invitations
  add column if not exists email_status text not null default 'not_attempted'
    check (email_status in ('not_attempted', 'sent', 'failed')),
  add column if not exists email_provider_id text,
  add column if not exists email_error text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_last_attempt_at timestamptz;

create index if not exists idx_patient_invitations_email_status
on public.patient_invitations(tenant_id, email_status, created_at desc);
