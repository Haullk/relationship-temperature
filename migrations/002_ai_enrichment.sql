create table if not exists relationship_report_metadata (
  source_url text primary key,
  resolved_title text,
  meta_description text,
  canonical_url text,
  status text not null,
  http_status integer,
  error_message text,
  fetched_at timestamptz not null default now()
);

create index if not exists relationship_report_metadata_fetched_at_idx
  on relationship_report_metadata (fetched_at desc);

create table if not exists relationship_ai_explanation_cache (
  pair_id text not null,
  turning_point_date date not null,
  input_hash text not null,
  model text not null,
  status text not null,
  ai_payload jsonb,
  error_message text,
  generated_at timestamptz not null default now(),
  primary key (pair_id, turning_point_date, input_hash, model)
);

create index if not exists relationship_ai_explanation_cache_lookup_idx
  on relationship_ai_explanation_cache (pair_id, turning_point_date, generated_at desc);
