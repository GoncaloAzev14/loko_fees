-- Loko Fees: schema, access rules and ledger views.
--
-- Access model: everyone (anon included) can READ everything; only users listed in
-- public.admins can WRITE. There is no per-fine "paid" flag: payments are recorded per
-- player and settled against that player's fines oldest-first (see fine_ledger), so
-- partial payments and credit fall out of the same rule.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  role       text not null default 'player' check (role in ('player', 'staff')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.fine_types (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  default_amount numeric(8, 2) not null check (default_amount >= 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Single-row table.
create table public.settings (
  singleton        boolean primary key default true check (singleton),
  late_fine_amount numeric(8, 2) not null default 5 check (late_fine_amount >= 0),
  -- Fines are due on this day of the month AFTER the fine date.
  due_day          int not null default 7 check (due_day between 1 and 28)
);
insert into public.settings default values;

create table public.fines (
  id             uuid primary key default gen_random_uuid(),
  seq            bigint generated always as identity,
  player_id      uuid not null references public.players (id) on delete cascade,
  fine_type_id   uuid references public.fine_types (id),
  kind           text not null default 'fine' check (kind in ('fine', 'late_fee')),
  amount         numeric(8, 2) not null check (amount >= 0),
  fined_on       date not null default current_date,
  description    text,
  -- First day of the month whose unpaid fines triggered this late fee.
  late_for_month date,
  cancelled      boolean not null default false,
  created_at     timestamptz not null default now(),
  check ((kind = 'late_fee') = (late_for_month is not null)),
  check (kind = 'late_fee' or fine_type_id is not null)
);
create index fines_player_idx on public.fines (player_id, fined_on, seq);
-- At most one late fee per player per month, even if the admin cancels it.
create unique index fines_one_late_fee_per_month
  on public.fines (player_id, late_for_month) where late_for_month is not null;

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players (id) on delete cascade,
  amount     numeric(8, 2) not null check (amount > 0),
  paid_on    date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);
create index payments_player_idx on public.payments (player_id);

-- Money into the box that is not a player's debt (prizes, donations, ...).
create table public.incomes (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid references public.players (id) on delete set null,
  amount      numeric(8, 2) not null check (amount > 0),
  received_on date not null default current_date,
  description text not null,
  created_at  timestamptz not null default now()
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  amount      numeric(8, 2) not null check (amount > 0),
  spent_on    date not null default current_date,
  description text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Admin check
-- ---------------------------------------------------------------------------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Row level security: read for all, write for admins
-- ---------------------------------------------------------------------------

alter table public.admins     enable row level security;
alter table public.players    enable row level security;
alter table public.fine_types enable row level security;
alter table public.settings   enable row level security;
alter table public.fines      enable row level security;
alter table public.payments   enable row level security;
alter table public.incomes    enable row level security;
alter table public.expenses   enable row level security;

create policy admins_read_self on public.admins
  for select using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['players', 'fine_types', 'settings', 'fines', 'payments', 'incomes', 'expenses']
  loop
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_write', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant select on public.admins to authenticated;
revoke insert, delete on public.settings from authenticated; -- single row, update only

-- ---------------------------------------------------------------------------
-- Ledger views
-- ---------------------------------------------------------------------------

-- Every fine with its due date and how much of it has been settled.
-- A player's payments cover their fines oldest-first; cancelled fines are skipped.
create view public.fine_ledger with (security_invoker = true) as
with paid as (
  select player_id, sum(amount) as total from public.payments group by player_id
),
ordered as (
  select f.*,
    coalesce(sum(case when f.cancelled then 0 else f.amount end) over (
      partition by f.player_id order by f.fined_on, f.seq
      rows between unbounded preceding and 1 preceding), 0) as owed_before
  from public.fines f
),
calc as (
  select o.*,
    (date_trunc('month', o.fined_on)::date + interval '1 month'
       + (s.due_day - 1) * interval '1 day')::date as due_on,
    case when o.cancelled then 0
         else least(o.amount, greatest(0, coalesce(p.total, 0) - o.owed_before))
    end as paid_amount
  from ordered o
  cross join public.settings s
  left join paid p on p.player_id = o.player_id
)
select
  c.id, c.seq, c.player_id, c.fine_type_id, c.kind, c.amount, c.fined_on, c.description,
  c.late_for_month, c.cancelled, c.created_at, c.due_on, c.paid_amount,
  c.amount - c.paid_amount as remaining,
  case when c.cancelled then 'cancelled'
       when c.paid_amount >= c.amount then 'paid'
       when c.due_on < current_date then 'overdue'
       else 'pending'
  end as status
from calc c;

create view public.player_balance with (security_invoker = true) as
select
  p.id as player_id, p.name, p.role, p.active,
  coalesce(f.total, 0) as total_fined,
  coalesce(pay.total, 0) as total_paid,
  greatest(0, coalesce(f.total, 0) - coalesce(pay.total, 0)) as outstanding,
  greatest(0, coalesce(pay.total, 0) - coalesce(f.total, 0)) as credit,
  coalesce(o.total, 0) as overdue
from public.players p
left join (select player_id, sum(amount) as total from public.fines
           where not cancelled group by player_id) f on f.player_id = p.id
left join (select player_id, sum(amount) as total from public.payments
           group by player_id) pay on pay.player_id = p.id
left join (select player_id, sum(remaining) as total from public.fine_ledger
           where status = 'overdue' group by player_id) o on o.player_id = p.id;

-- One row: what is in the box and what is still owed to it.
create view public.club_summary with (security_invoker = true) as
select
  coalesce((select sum(amount) from public.payments), 0)
    + coalesce((select sum(amount) from public.incomes), 0) as total_in,
  coalesce((select sum(amount) from public.expenses), 0) as total_out,
  coalesce((select sum(amount) from public.payments), 0)
    + coalesce((select sum(amount) from public.incomes), 0)
    - coalesce((select sum(amount) from public.expenses), 0) as box,
  coalesce((select sum(outstanding) from public.player_balance), 0) as total_outstanding,
  coalesce((select sum(overdue) from public.player_balance), 0) as total_overdue,
  coalesce((select sum(credit) from public.player_balance), 0) as total_credit;

grant select on public.fine_ledger, public.player_balance, public.club_summary
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Late fees
-- ---------------------------------------------------------------------------

-- Adds one late fee per player per month for players who still owe part of that month's
-- fines after the due date. Idempotent. Run daily by pg_cron (see supabase/cron.sql) and
-- by an admin through apply_late_fees_admin().
create function public.apply_late_fees(p_today date default current_date) returns integer
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
  on conflict (player_id, late_for_month) where late_for_month is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create function public.apply_late_fees_admin() returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return public.apply_late_fees();
end $$;

revoke all on function public.apply_late_fees(date) from public, anon, authenticated;
revoke all on function public.apply_late_fees_admin() from public, anon;
grant execute on function public.apply_late_fees_admin() to authenticated;
