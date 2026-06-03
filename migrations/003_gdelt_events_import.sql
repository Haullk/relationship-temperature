create table if not exists gdelt_events_clean (
  global_event_id bigint primary key,
  event_date date not null,
  date_added timestamptz,
  actor1_name text,
  actor1_country_code text,
  actor2_name text,
  actor2_country_code text,
  event_code text,
  event_base_code text,
  event_root_code text,
  quad_class integer,
  goldstein_scale double precision,
  num_mentions integer not null default 0,
  num_articles integer not null default 0,
  source_url text,
  source_domain text,
  source_file text,
  source_file_timestamp timestamptz,
  imported_at timestamptz not null default now()
);

create index if not exists gdelt_events_clean_relationship_idx
  on gdelt_events_clean (event_date, actor1_country_code, actor2_country_code)
  where goldstein_scale is not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'gdelt_events_clean'
      and column_name = 'source_file_timestamp'
  ) then
    create index if not exists gdelt_events_clean_source_file_idx
      on gdelt_events_clean (source_file_timestamp desc);
  end if;
end $$;

create table if not exists relationship_gdelt_import_files (
  file_name text primary key,
  file_timestamp timestamptz not null,
  source_url text not null,
  status text not null check (status in ('imported', 'skipped', 'failed')),
  rows_seen integer not null default 0,
  rows_imported integer not null default 0,
  rows_skipped integer not null default 0,
  error_message text,
  imported_at timestamptz not null default now()
);

create index if not exists relationship_gdelt_import_files_timestamp_idx
  on relationship_gdelt_import_files (file_timestamp desc);
