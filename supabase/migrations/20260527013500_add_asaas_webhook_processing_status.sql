alter table public.asaas_webhook_events
  add column if not exists processed_status text not null default 'received',
  add column if not exists processed_result text,
  add column if not exists error_message text;

alter table public.asaas_webhook_events
  drop constraint if exists asaas_webhook_events_processed_status_check,
  add constraint asaas_webhook_events_processed_status_check
    check (processed_status in ('received', 'processed', 'ignored', 'failed'));

create index if not exists idx_asaas_webhook_events_processed_status
on public.asaas_webhook_events(processed_status, processed_at desc);
