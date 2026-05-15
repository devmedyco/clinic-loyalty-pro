alter table public.card_validations
  alter column card_id drop not null,
  add column if not exists reason text,
  add column if not exists qr_token_snapshot text;

alter table public.card_validations
  drop constraint if exists card_validations_card_id_fkey,
  add constraint card_validations_card_id_fkey
    foreign key (card_id)
    references public.benefit_cards(id)
    on delete set null;
