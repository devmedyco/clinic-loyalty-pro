create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('patient_card_terms', 'privacy_policy', 'platform_terms')),
  title text not null,
  version text not null,
  content text not null,
  active boolean not null default true,
  required_for_patient boolean not null default false,
  created_at timestamptz not null default now(),
  unique (type, version)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  unique (document_id, patient_id, user_id)
);

create index idx_legal_documents_active on public.legal_documents(type, active);
create index idx_legal_acceptances_patient on public.legal_acceptances(patient_id, accepted_at desc);
create index idx_legal_acceptances_tenant on public.legal_acceptances(tenant_id, accepted_at desc);

alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;

create policy "active legal documents are readable"
on public.legal_documents for select to anon, authenticated
using (active = true or private.is_super_admin((select auth.uid())));

create policy "legal acceptance read access"
on public.legal_acceptances for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
);

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
  )
);

grant select on public.legal_documents to anon, authenticated;
grant select, insert on public.legal_acceptances to authenticated;

insert into public.legal_documents (type, title, version, required_for_patient, content)
values (
  'patient_card_terms',
  'Termo de Uso do Cartão de Benefícios Medyco',
  '2026-05-15',
  true,
  'Este é um modelo operacional inicial de termo de uso do cartão de benefícios Medyco e deve ser revisado por assessoria jurídica antes do uso comercial definitivo.

Ao aceitar este termo, o paciente declara que compreende que o cartão digital de benefícios não é plano de saúde, convênio médico, seguro saúde ou promessa de cobertura assistencial. O cartão permite acesso a condições comerciais, descontos ou benefícios oferecidos pela clínica ou rede participante, conforme disponibilidade e regras vigentes.

O paciente reconhece que os descontos, serviços, valores, disponibilidade de agenda e condições de atendimento podem variar conforme a clínica, profissional, especialidade, campanha ou unidade participante. A Medyco e a clínica poderão atualizar serviços, preços, regras de elegibilidade e condições de uso mediante comunicação adequada.

O cartão é pessoal, digital e intransferível. O paciente se compromete a manter seus dados atualizados, não compartilhar o cartão para uso por terceiros e apresentar o cartão ou QR Code quando solicitado pela recepção. O uso indevido poderá resultar em bloqueio, suspensão ou cancelamento do benefício.

O acesso aos benefícios pode depender de assinatura ativa, pagamento em dia, cadastro válido e cartão não expirado ou bloqueado. Em caso de inadimplência, cancelamento, fraude, divergência cadastral ou violação das regras, a clínica poderá negar a validação do cartão.

O paciente autoriza o tratamento dos dados necessários para cadastro, identificação, emissão do cartão digital, validação de uso, histórico de atendimentos, comunicação operacional e cumprimento de obrigações legais, observada a Política de Privacidade aplicável e a legislação brasileira de proteção de dados.

Ao prosseguir, o paciente confirma que leu, compreendeu e aceita as condições deste termo.'
);
