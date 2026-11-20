-- A switch for the automatic late fee ("multa de falta de pagamento").
--
-- Until now the rule always ran. Now an admin can turn it off (and on again) from the Regulamento page.
-- Off means no NEW late fees are added; the ones already charged are left exactly as they are (they can be
-- deleted one by one, as before). The amount and the due day are kept, so turning it back on is a single tap.

alter table public.settings add column late_fee_enabled boolean not null default true;

-- Same rule as before (see 20261118000000_late_fee_waivers.sql), plus: nothing is added while the switch is off.
create or replace function public.apply_late_fees(p_today date default current_date) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  insert into public.fines (player_id, kind, amount, fined_on, late_for_month)
  select d.player_id, 'late_fee', s.late_fine_amount, d.due_on + 1, d.month
  from (
    select distinct l.player_id, date_trunc('month', l.fined_on)::date as month, l.due_on
    from public.fine_ledger l
    where l.kind = 'fine' and not l.cancelled and l.remaining > 0 and l.due_on < p_today
  ) d
  cross join public.settings s
  where s.late_fee_enabled  -- the admin switched the rule off: add nothing
    and not exists (  -- an admin deleted this one on purpose: it stays deleted
      select 1 from public.late_fee_waivers w where w.player_id = d.player_id and w.month = d.month
    )
  on conflict (player_id, late_for_month) where late_for_month is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
