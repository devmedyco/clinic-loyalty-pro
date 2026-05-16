create or replace function private.uuid_or_null(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  specialty text,
  document text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (provider_id, service_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  type text not null default 'info',
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'whatsapp')),
  title text not null,
  body text not null,
  action_url text,
  status text not null default 'unread' check (status in ('unread', 'read', 'queued', 'sent', 'failed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_providers_tenant_active on public.providers(tenant_id, active, name);
create index idx_providers_search on public.providers(tenant_id, specialty, city, state);
create index idx_provider_services_provider on public.provider_services(provider_id);
create index idx_provider_services_service on public.provider_services(service_id);
create index idx_notifications_recipient on public.notifications(recipient_user_id, status, created_at desc);
create index idx_notifications_tenant on public.notifications(tenant_id, created_at desc);
create index idx_notifications_scheduled on public.notifications(scheduled_for)
where scheduled_for is not null and status = 'queued';

create trigger providers_updated_at
before update on public.providers
for each row execute function private.touch_updated_at();

alter table public.providers enable row level security;
alter table public.provider_services enable row level security;
alter table public.notifications enable row level security;

create policy "provider read access"
on public.providers for select to authenticated
using (
  active = true
  or private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
);

create policy "tenant members manage providers"
on public.providers for all to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id) or private.is_super_admin((select auth.uid())))
with check (private.has_tenant_access((select auth.uid()), tenant_id) or private.is_super_admin((select auth.uid())));

create policy "provider service read access"
on public.provider_services for select to authenticated
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

create policy "tenant members manage provider services"
on public.provider_services for all to authenticated
using (private.has_tenant_access((select auth.uid()), tenant_id) or private.is_super_admin((select auth.uid())))
with check (private.has_tenant_access((select auth.uid()), tenant_id) or private.is_super_admin((select auth.uid())));

create policy "notification read access"
on public.notifications for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  or private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
);

create policy "tenant members create notifications"
on public.notifications for insert to authenticated
with check (
  private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
  or recipient_user_id = (select auth.uid())
);

create policy "notification update access"
on public.notifications for update to authenticated
using (
  recipient_user_id = (select auth.uid())
  or private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
)
with check (
  recipient_user_id = (select auth.uid())
  or private.has_tenant_access((select auth.uid()), tenant_id)
  or private.is_super_admin((select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tenant-assets', 'tenant-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('profile-avatars', 'profile-avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads tenant assets" on storage.objects;
create policy "public reads tenant assets"
on storage.objects for select to public
using (bucket_id in ('tenant-assets', 'profile-avatars'));

drop policy if exists "tenant members upload tenant assets" on storage.objects;
create policy "tenant members upload tenant assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tenant-assets'
  and (
    private.has_tenant_access((select auth.uid()), private.uuid_or_null((storage.foldername(name))[1]))
    or private.is_super_admin((select auth.uid()))
  )
);

drop policy if exists "tenant members update tenant assets" on storage.objects;
create policy "tenant members update tenant assets"
on storage.objects for update to authenticated
using (
  bucket_id = 'tenant-assets'
  and (
    private.has_tenant_access((select auth.uid()), private.uuid_or_null((storage.foldername(name))[1]))
    or private.is_super_admin((select auth.uid()))
  )
)
with check (
  bucket_id = 'tenant-assets'
  and (
    private.has_tenant_access((select auth.uid()), private.uuid_or_null((storage.foldername(name))[1]))
    or private.is_super_admin((select auth.uid()))
  )
);

drop policy if exists "users upload own avatars" on storage.objects;
create policy "users upload own avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users update own avatars" on storage.objects;
create policy "users update own avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter table public.legal_documents
  drop constraint if exists legal_documents_type_check,
  add constraint legal_documents_type_check
    check (type in ('patient_card_terms', 'privacy_policy', 'platform_terms', 'clinic_service_agreement', 'cancellation_policy'));

insert into public.legal_documents (type, title, version, required_for_patient, content)
values
  (
    'patient_card_terms',
    'Termo de uso do cartão de benefícios Medyco',
    '2026.05-mvp',
    true,
    'Minuta para revisão jurídica. O paciente declara ciência de que o cartão digital Medyco é um benefício de descontos e acesso facilitado a serviços privados de saúde, não sendo plano de saúde, seguro saúde ou convênio médico. O uso do cartão depende de assinatura ativa, cadastro correto, aceite dos termos e validação operacional pela clínica. A clínica pode negar a utilização quando houver inadimplência, cartão bloqueado, expiração, divergência cadastral, uso indevido ou indisponibilidade operacional. Descontos, serviços, valores e profissionais participantes podem variar por clínica e devem ser confirmados antes do atendimento. O paciente autoriza o tratamento de dados cadastrais e operacionais necessários para identificação, validação do cartão, cobrança, atendimento, auditoria e cumprimento de obrigações legais, observada a política de privacidade aplicável.'
  ),
  (
    'privacy_policy',
    'Política de privacidade Medyco',
    '2026.05-mvp',
    false,
    'Minuta para revisão jurídica. A Medyco trata dados pessoais para operar programas de benefícios em saúde, autenticar usuários, validar cartões digitais, registrar atendimentos, processar cobranças, enviar comunicações transacionais, prevenir fraudes e cumprir obrigações legais. Dados podem incluir identificação, contato, documentos, vínculo com clínica, histórico de validações, pagamentos e aceite de termos. O compartilhamento ocorre apenas com clínicas contratantes, prestadores autorizados, operadores de pagamento, provedores de e-mail, infraestrutura de hospedagem e autoridades quando necessário. O titular pode solicitar acesso, correção, portabilidade, exclusão quando aplicável e informações sobre tratamento pelos canais oficiais da plataforma.'
  ),
  (
    'platform_terms',
    'Termos de uso da plataforma Medyco',
    '2026.05-mvp',
    false,
    'Minuta para revisão jurídica. A Medyco fornece infraestrutura tecnológica white-label para clínicas criarem e operarem programas próprios de benefícios, recorrência, cartões digitais, validação QR, gestão de pacientes e registros operacionais. A clínica contratante é responsável pela oferta comercial ao paciente, pela veracidade das informações publicadas, pela regularidade dos serviços prestados, pela emissão fiscal quando aplicável e pelo atendimento das normas de saúde, consumo e proteção de dados. A Medyco não presta serviços médicos, não intermedeia ato médico e não substitui plano de saúde.'
  ),
  (
    'clinic_service_agreement',
    'Contrato comercial da clínica contratante',
    '2026.05-mvp',
    false,
    'Minuta para revisão jurídica. A clínica contratante adere ao uso da plataforma Medyco para operar seu programa de benefícios. O contrato deve definir plano contratado, mensalidade, limites, responsabilidades da clínica, responsabilidades da Medyco, suporte, confidencialidade, proteção de dados, propriedade da marca, regras de cancelamento, inadimplência, reajuste, SLA quando contratado e hipóteses de suspensão. A clínica reconhece que permanece responsável por pacientes, profissionais, serviços, preços, descontos, notas fiscais, alvarás, conselhos profissionais e obrigações legais do seu negócio.'
  ),
  (
    'cancellation_policy',
    'Política de cancelamento, inadimplência, renovação e reativação',
    '2026.05-mvp',
    false,
    'Minuta para revisão jurídica. Assinaturas podem ser renovadas automaticamente conforme plano contratado. Pagamentos não identificados até o vencimento podem gerar lembretes, bloqueio temporário do cartão, suspensão de benefícios e posterior cancelamento, conforme prazos definidos pela clínica. A reativação pode depender da quitação de valores em aberto e atualização cadastral. Cancelamentos devem respeitar regras comerciais informadas no momento da contratação e direitos do consumidor aplicáveis. Reembolsos, estornos e cobranças proporcionais devem ser tratados conforme política da clínica e meios de pagamento utilizados.'
  )
on conflict (type, version) where tenant_id is null do update
set title = excluded.title,
    required_for_patient = excluded.required_for_patient,
    content = excluded.content,
    active = true;

grant select, insert, update, delete on public.providers to authenticated;
grant select, insert, update, delete on public.provider_services to authenticated;
grant select, insert, update on public.notifications to authenticated;
