-- Fix unresolved insider trade ingestion so unresolved trades do not count as resolved wallet history.
-- Verification query 1:
-- select wallet, resolved_trades, total_wins
-- from public.wallet_history
-- where wallet in ('0xexamplewallet');
--
-- Verification query 2:
-- select
--   wallet,
--   count(*) filter (where is_win is not null) as resolved_trades,
--   count(*) filter (where is_win = true) as total_wins
-- from public.insider_trade_ledger
-- where wallet in ('0xexamplewallet')
-- group by wallet;

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
    p_is_win := null
  );

  return true;
end;
$$;

with ledger_totals as (
  select
    wallet,
    count(*) filter (where is_win is not null)::integer as resolved_trades,
    count(*) filter (where is_win = true)::integer as total_wins
  from public.insider_trade_ledger
  group by wallet
)
update public.wallet_history as wh
set
  resolved_trades = coalesce(ledger_totals.resolved_trades, 0),
  total_wins = coalesce(ledger_totals.total_wins, 0),
  updated_at = now()
from ledger_totals
where wh.wallet = ledger_totals.wallet;

update public.wallet_history as wh
set
  resolved_trades = 0,
  total_wins = 0,
  updated_at = now()
where not exists (
  select 1
  from public.insider_trade_ledger as ledger
  where ledger.wallet = wh.wallet
)
  and (coalesce(wh.resolved_trades, 0) <> 0 or coalesce(wh.total_wins, 0) <> 0);
