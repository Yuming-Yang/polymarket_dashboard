create table if not exists public.wallet_history (
  wallet text primary key,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  total_trades integer not null default 0,
  total_wins integer not null default 0,
  total_volume numeric not null default 0,
  markets text[] not null default '{}'::text[],
  consecutive_large integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.insider_alerts (
  id bigserial primary key,
  detected_at timestamptz not null default now(),
  trade_id text not null unique,
  market_id text not null,
  market_slug text,
  market_title text,
  wallet text not null,
  size_usdc numeric not null,
  price numeric not null,
  side text not null check (side in ('BUY', 'SELL')),
  score numeric not null check (score >= 0 and score <= 10),
  flags jsonb not null default '[]'::jsonb,
  wallet_age_h numeric,
  wallet_win_rate numeric,
  wallet_total_trades integer not null default 0
);

create index if not exists idx_insider_alerts_score_desc on public.insider_alerts (score desc);
create index if not exists idx_insider_alerts_detected_at_desc on public.insider_alerts (detected_at desc);
create index if not exists idx_insider_alerts_market_id on public.insider_alerts (market_id);
create index if not exists idx_insider_alerts_wallet on public.insider_alerts (wallet);

create table if not exists public.insider_scan_state (
  scan_key text primary key,
  last_scanned_at timestamptz not null default now(),
  scanned_count integer not null default 0,
  analyzed_count integer not null default 0,
  alerts_count integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.insider_scan_state (scan_key)
values ('global')
on conflict (scan_key) do nothing;

create table if not exists public.insider_trade_ledger (
  trade_id text primary key,
  market_id text not null,
  market_slug text,
  market_title text,
  wallet text not null,
  token_id text,
  outcome text,
  side text not null check (side in ('BUY', 'SELL')),
  size_usdc numeric not null,
  price numeric not null,
  traded_at timestamptz not null,
  is_large boolean not null default false,
  settled_at timestamptz,
  is_win boolean,
  win_applied boolean not null default false,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_insider_trade_ledger_wallet on public.insider_trade_ledger (wallet);
create index if not exists idx_insider_trade_ledger_market_id on public.insider_trade_ledger (market_id);
create index if not exists idx_insider_trade_ledger_traded_at on public.insider_trade_ledger (traded_at desc);
create index if not exists idx_insider_trade_ledger_unsettled_traded_at
  on public.insider_trade_ledger (traded_at asc)
  where is_win is null;

create or replace function public.upsert_wallet_history(
  p_wallet text,
  p_seen_at timestamptz,
  p_market_id text,
  p_trade_value numeric,
  p_is_large boolean,
  p_is_win boolean default false
)
returns setof public.wallet_history
language plpgsql
as $$
declare
  result public.wallet_history%rowtype;
begin
  insert into public.wallet_history as wh (
    wallet,
    first_seen_at,
    last_seen_at,
    total_trades,
    total_wins,
    total_volume,
    markets,
    consecutive_large,
    updated_at
  )
  values (
    lower(p_wallet),
    p_seen_at,
    p_seen_at,
    1,
    case when coalesce(p_is_win, false) then 1 else 0 end,
    coalesce(p_trade_value, 0),
    case
      when p_market_id is null or p_market_id = '' then '{}'::text[]
      else array[p_market_id]
    end,
    case when coalesce(p_is_large, false) then 1 else 0 end,
    now()
  )
  on conflict (wallet) do update
  set
    first_seen_at = coalesce(least(wh.first_seen_at, excluded.first_seen_at), wh.first_seen_at, excluded.first_seen_at),
    last_seen_at = coalesce(greatest(wh.last_seen_at, excluded.last_seen_at), wh.last_seen_at, excluded.last_seen_at),
    total_trades = wh.total_trades + 1,
    total_wins = wh.total_wins + case when coalesce(p_is_win, false) then 1 else 0 end,
    total_volume = wh.total_volume + coalesce(p_trade_value, 0),
    markets = case
      when p_market_id is null or p_market_id = '' then wh.markets
      when p_market_id = any(coalesce(wh.markets, '{}'::text[])) then wh.markets
      else array_append(coalesce(wh.markets, '{}'::text[]), p_market_id)
    end,
    consecutive_large = case
      when coalesce(p_is_large, false) then coalesce(wh.consecutive_large, 0) + 1
      else 0
    end,
    updated_at = now()
  returning * into result;

  return next result;
end;
$$;

create or replace function public.ingest_insider_trade(
  p_trade_id text,
  p_market_id text,
  p_market_slug text,
  p_market_title text,
  p_wallet text,
  p_token_id text,
  p_outcome text,
  p_side text,
  p_size_usdc numeric,
  p_price numeric,
  p_traded_at timestamptz,
  p_is_large boolean,
  p_raw jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
as $$
declare
  inserted_rows integer := 0;
begin
  insert into public.insider_trade_ledger (
    trade_id,
    market_id,
    market_slug,
    market_title,
    wallet,
    token_id,
    outcome,
    side,
    size_usdc,
    price,
    traded_at,
    is_large,
    raw,
    updated_at
  )
  values (
    p_trade_id,
    p_market_id,
    p_market_slug,
    p_market_title,
    lower(p_wallet),
    p_token_id,
    p_outcome,
    p_side,
    p_size_usdc,
    p_price,
    p_traded_at,
    coalesce(p_is_large, false),
    coalesce(p_raw, '{}'::jsonb),
    now()
  )
  on conflict (trade_id) do nothing;

  get diagnostics inserted_rows = row_count;

  if inserted_rows = 0 then
    return false;
  end if;

  perform public.upsert_wallet_history(
    p_wallet := lower(p_wallet),
    p_seen_at := p_traded_at,
    p_market_id := p_market_id,
    p_trade_value := p_size_usdc,
    p_is_large := p_is_large,
    p_is_win := false
  );

  return true;
end;
$$;

create or replace function public.settle_insider_trade(
  p_trade_id text,
  p_is_win boolean,
  p_settled_at timestamptz default now()
)
returns boolean
language plpgsql
as $$
declare
  current_row public.insider_trade_ledger%rowtype;
begin
  select *
  into current_row
  from public.insider_trade_ledger
  where trade_id = p_trade_id
  for update;

  if not found then
    return false;
  end if;

  if current_row.is_win is not null then
    return false;
  end if;

  update public.insider_trade_ledger
  set
    is_win = p_is_win,
    settled_at = coalesce(p_settled_at, now()),
    win_applied = coalesce(p_is_win, false),
    updated_at = now()
  where trade_id = p_trade_id;

  if coalesce(p_is_win, false) then
    update public.wallet_history
    set
      total_wins = coalesce(total_wins, 0) + 1,
      updated_at = now()
    where wallet = current_row.wallet;
  end if;

  return true;
end;
$$;
