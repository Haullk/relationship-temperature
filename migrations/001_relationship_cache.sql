create table if not exists relationship_trend_cache (
  pair_id text primary key,
  object_a text not null,
  object_b text not null,
  display_name text not null,
  data_start date,
  data_end date,
  generated_at timestamptz not null default now(),
  cache_status text not null default 'fresh',
  payload jsonb not null
);

create index if not exists relationship_trend_cache_generated_at_idx
  on relationship_trend_cache (generated_at desc);

