alter table public.wallet_history
  add column if not exists resolved_trades integer not null default 0;

update public.wallet_history
set resolved_trades = greatest(coalesce(resolved_trades, 0), coalesce(total_wins, 0))
where coalesce(resolved_trades, 0) < coalesce(total_wins, 0);

create or replace function public.upsert_wallet_history(
  p_wallet text,
  p_seen_at timestamptz,
  p_market_id text,
  p_trade_value numeric,
  p_is_large boolean,
  p_is_win boolean default null
)
returns setof public.wallet_history
language plpgsql
as $$
declare
  result public.wallet_history%rowtype;
  resolved_increment integer := case when p_is_win is null then 0 else 1 end;
  win_increment integer := case when coalesce(p_is_win, false) then 1 else 0 end;
begin
  insert into public.wallet_history as wh (
    wallet,
    first_seen_at,
    last_seen_at,
    total_trades,
    total_wins,
    resolved_trades,
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
    win_increment,
    resolved_increment,
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
    total_wins = wh.total_wins + win_increment,
    resolved_trades = wh.resolved_trades + resolved_increment,
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

  update public.wallet_history
  set
    resolved_trades = coalesce(resolved_trades, 0) + 1,
    total_wins = coalesce(total_wins, 0) + case when coalesce(p_is_win, false) then 1 else 0 end,
    updated_at = now()
  where wallet = current_row.wallet;

  return true;
end;
$$;
