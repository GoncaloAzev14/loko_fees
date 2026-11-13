-- Seasons: the name shown in the app, a closing step that archives a summary and starts clean,
-- and safe deletes of players and fine types.

alter table public.settings
  add column season text not null default '2026/27' check (season ~ '^\d{4}/\d{2}$');

-- ---------------------------------------------------------------------------
-- Deleting players and fine types
-- ---------------------------------------------------------------------------
-- Admins may delete them (the delete grants from the first migration stay), but not while
-- anything depends on them. A player with fines or payments cannot be deleted: that would erase
-- money from the box. Close the season first (it clears fines and payments), then delete.
-- (A fine type that fines still use is already protected by its foreign key.)
alter table public.fines
  drop constraint fines_player_id_fkey,
  add constraint fines_player_id_fkey foreign key (player_id) references public.players (id) on delete restrict;
alter table public.payments
  drop constraint payments_player_id_fkey,
  add constraint payments_player_id_fkey foreign key (player_id) references public.players (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Season archive: a record of each closed season, visible to admins only.
-- It keeps totals per season, per player and per fine type, not every single row.
-- ---------------------------------------------------------------------------

create table public.season_archive (
  id                uuid primary key default gen_random_uuid(),
  season            text not null,
  closed_at         timestamptz not null default now(),
  fines_count       int not null,
  total_fined       numeric(10, 2) not null,
  total_paid        numeric(10, 2) not null,
  total_outstanding numeric(10, 2) not null,
  total_credit      numeric(10, 2) not null,
  total_income      numeric(10, 2) not null,
  total_expenses    numeric(10, 2) not null,
  box               numeric(10, 2) not null
);

create table public.season_archive_players (
  archive_id  uuid not null references public.season_archive (id) on delete cascade,
  player_name text not null,
  role        text not null,
  fines_count int not null,
  total_fined numeric(10, 2) not null,
  total_paid  numeric(10, 2) not null,
  outstanding numeric(10, 2) not null,
  credit      numeric(10, 2) not null,
  primary key (archive_id, player_name)
);

create table public.season_archive_types (
  archive_id   uuid not null references public.season_archive (id) on delete cascade,
  fine_type    text not null,
  fines_count  int not null,
  total_amount numeric(10, 2) not null,
  primary key (archive_id, fine_type)
);

alter table public.season_archive         enable row level security;
alter table public.season_archive_players enable row level security;
alter table public.season_archive_types   enable row level security;

-- Only admins read or prune the archive; rows are written by close_season() alone.
do $$
declare t text;
begin
  foreach t in array array['season_archive', 'season_archive_players', 'season_archive_types']
  loop
    execute format('create policy %I on public.%I for select using (public.is_admin())', t || '_admin_read', t);
    execute format('create policy %I on public.%I for delete using (public.is_admin())', t || '_admin_delete', t);
    execute format('grant select, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Closing a season
-- ---------------------------------------------------------------------------
-- Archives a summary of the current season, then clears fines, payments, income and expenses
-- and starts the next season. The cash in the box carries over as an opening entry, so the box
-- is the same before and after. Unpaid fines and player credit are NOT carried over (they are
-- in the archive). Players and the fine catalog are untouched. Returns the archive id.
create function public.close_season(p_next_season text) returns uuid
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

revoke all on function public.close_season(text) from public, anon;
grant execute on function public.close_season(text) to authenticated;
