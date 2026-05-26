with ranked_documents as (
  select
    id,
    row_number() over (
      partition by tenant_id, type
      order by created_at desc, id desc
    ) as rank
  from public.legal_documents
  where active = true
    and required_for_patient = true
)
update public.legal_documents d
set active = false
from ranked_documents ranked
where ranked.id = d.id
  and ranked.rank > 1;

create unique index if not exists idx_one_active_required_patient_legal_document
on public.legal_documents (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), type)
where active = true and required_for_patient = true;
