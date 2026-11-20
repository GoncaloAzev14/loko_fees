-- A late fee that an admin deletes stays deleted.
--
-- The rule says: one late fee per player per month while that month's fines are unpaid. It is applied
-- every time an admin opens the app, so deleting the row only worked until the next time: the rule saw
-- an unpaid month with no late fee and added it again. (Cancelling it never had this problem, because
-- a cancelled row still exists and the unique index counts it.)
--
-- Now deleting a late fee leaves a note ("waived") for that player and month, and the rule skips it.
-- Closing a season clears the notes, with the fines they belong to.

create table public.late_fee_waivers (
  player_id uuid not null references public.players (id) on delete cascade,
  month     date not null,                         -- first day of the month, as in fines.late_for_month
  waived_at timestamptz not null default now(),
  primary key (player_id, month)
);

alter table public.late_fee_waivers enable row level security;
create policy late_fee_waivers_admin_read on public.late_fee_waivers for select using (public.is_admin());
grant select on public.late_fee_waivers to authenticated;

create function public.remember_deleted_late_fee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.late_fee_waivers (player_id, month) values (old.player_id, old.late_for_month)
  on conflict do nothing;
  return old;
end $$;

create trigger fines_remember_deleted_late_fee
  after delete on public.fines
  for each row when (old.kind = 'late_fee')
  execute function public.remember_deleted_late_fee();

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
  where not exists (  -- an admin deleted this one on purpose: it stays deleted
    select 1 from public.late_fee_waivers w where w.player_id = d.player_id and w.month = d.month
  )
  on conflict (player_id, late_for_month) where late_for_month is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.close_season(p_next_season text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cur text;
  sid uuid;
  box_now numeric;
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem fechar a época.' using errcode = '42501';
  end if;
  if p_next_season !~ '^\d{4}/\d{2}$' then
    raise exception 'Época inválida: use o formato 2026/27.';
  end if;
  select season into cur from public.settings;
  if p_next_season = cur then
    raise exception 'A nova época tem de ser diferente da atual (%).', cur;
  end if;

  select box into box_now from public.club_summary;

  insert into public.season_archive
    (season, fines_count, total_fined, total_paid, total_outstanding, total_credit, total_income, total_expenses, box)
  select cur,
         (select count(*) from public.fines where not cancelled),
         coalesce((select sum(amount) from public.fines where not cancelled), 0),
         coalesce((select sum(amount) from public.payments), 0),
         s.total_outstanding, s.total_credit,
         coalesce((select sum(amount) from public.incomes), 0),
         coalesce((select sum(amount) from public.expenses), 0),
         s.box
  from public.club_summary s
  returning id into sid;

  insert into public.season_archive_players
    (archive_id, player_name, role, fines_count, total_fined, total_paid, outstanding, credit)
  select sid, b.name, b.role, coalesce(c.n, 0), b.total_fined, b.total_paid, b.outstanding, b.credit
  from public.player_balance b
  left join (select player_id, count(*) as n from public.fines where not cancelled group by player_id) c
    on c.player_id = b.player_id
  where b.total_fined > 0 or b.total_paid > 0;

  insert into public.season_archive_types (archive_id, fine_type, fines_count, total_amount)
  select sid, x.name, count(*), sum(x.amount)
  from (
    select coalesce(t.name, 'Multa de falta de pagamento') as name, f.amount
    from public.fines f left join public.fine_types t on t.id = f.fine_type_id
    where not f.cancelled
  ) x
  group by x.name;

  delete from public.fines where true;
  delete from public.payments where true;
  delete from public.incomes where true;
  delete from public.expenses where true;
  delete from public.late_fee_waivers where true; -- they belonged to the season being closed

  if box_now > 0 then
    insert into public.incomes (amount, received_on, description)
    values (box_now, current_date, 'Saldo transitado da época ' || cur);
  elsif box_now < 0 then
    insert into public.expenses (amount, spent_on, description)
    values (-box_now, current_date, 'Saldo negativo transitado da época ' || cur);
  end if;

  update public.settings set season = p_next_season;
  return sid;
end $$;
