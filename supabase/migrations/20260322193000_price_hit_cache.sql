create table if not exists public.price_hit_event_cache (
  asset text primary key,
  search_query text not null,
  events jsonb not null default '[]'::jsonb,
  refreshed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_price_hit_event_cache_expires_at on public.price_hit_event_cache (expires_at asc);
