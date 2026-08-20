alter table offers add column if not exists external_id text;

create unique index if not exists offers_store_external_id_idx
  on offers (store_id, external_id)
  where external_id is not null;
