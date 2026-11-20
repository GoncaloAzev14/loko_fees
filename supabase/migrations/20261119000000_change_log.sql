-- A permanent record of who changed what, and a way to put back something deleted by mistake.
--
-- Every insert, update and delete on the club's data (fines, payments, income, expenses, players,
-- fine types and the settings) is written to change_log by the database itself, with the person who
-- did it (null = the system: the daily job, the dashboard, a script) and the row before and after.
-- Nobody can edit or delete this record through the app, not even an admin: the table has no access
-- for app users at all, only the two functions below can read it.
--
-- With it, "it just disappeared" always has an answer, and a deleted row can be put back.

create table public.change_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  who        uuid,                                    -- auth.uid(); null for the system
  action     text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  row_id     uuid,                                    -- null for settings, which has no id
  old_row    jsonb,
  new_row    jsonb
);
create index change_log_row_idx on public.change_log (row_id);

alter table public.change_log enable row level security;  -- no policies: closed to everyone but the functions below
revoke all on public.change_log from public, anon, authenticated;

create function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb;
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new; -- nothing changed: not worth a line
  end if;
  j := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  insert into public.change_log (who, action, table_name, row_id, old_row, new_row)
  values (
    auth.uid(), lower(tg_op), tg_table_name, (j ->> 'id')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['fines', 'payments', 'incomes', 'expenses', 'players', 'fine_types', 'settings']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_change()',
      t || '_log_change', t);
  end loop;
end $$;

-- The latest changes, newest first, for admins. `restorable` is true for a delete that has not been put back.
create function public.list_changes(p_limit int default 200)
returns table (id bigint, at timestamptz, who_email text, action text, table_name text, row_id uuid,
               old_row jsonb, new_row jsonb, restorable boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.at, u.email::text, c.action, c.table_name, c.row_id, c.old_row, c.new_row,
         (c.action = 'delete'
          and c.table_name in ('fines', 'payments', 'incomes', 'expenses', 'players', 'fine_types')
          and not exists (select 1 from public.change_log later
                          where later.row_id = c.row_id and later.id > c.id and later.action = 'insert')) as restorable
  from public.change_log c
  left join auth.users u on u.id = c.who
  where public.is_admin()
  order by c.id desc
  limit least(greatest(p_limit, 1), 1000);
$$;

-- Puts back a row that was deleted, exactly as it was (same id, amounts, dates), from its change_log line.
create function public.restore_change(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.change_log%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem repor.' using errcode = '42501';
  end if;
  select * into c from public.change_log where id = p_id;
  if not found then
    raise exception 'Esse registo já não existe.';
  end if;
  if c.action <> 'delete' then
    raise exception 'Só se pode repor uma linha que foi apagada.';
  end if;

  case c.table_name
    when 'fines' then
      insert into public.fines (id, player_id, fine_type_id, kind, amount, fined_on, description, late_for_month, cancelled, created_at)
      select r.id, r.player_id, r.fine_type_id, r.kind, r.amount, r.fined_on, r.description, r.late_for_month, r.cancelled, r.created_at
      from jsonb_populate_record(null::public.fines, c.old_row) r;
      -- a restored late fee is wanted again: forget that it was waived
      delete from public.late_fee_waivers
      where player_id = (c.old_row ->> 'player_id')::uuid and month = (c.old_row ->> 'late_for_month')::date;
    when 'payments' then
      insert into public.payments (id, player_id, amount, paid_on, note, created_at)
      select r.id, r.player_id, r.amount, r.paid_on, r.note, r.created_at from jsonb_populate_record(null::public.payments, c.old_row) r;
    when 'incomes' then
      insert into public.incomes (id, player_id, amount, received_on, description, created_at)
      select r.id, r.player_id, r.amount, r.received_on, r.description, r.created_at from jsonb_populate_record(null::public.incomes, c.old_row) r;
    when 'expenses' then
      insert into public.expenses (id, amount, spent_on, description, created_at)
      select r.id, r.amount, r.spent_on, r.description, r.created_at from jsonb_populate_record(null::public.expenses, c.old_row) r;
    when 'players' then
      insert into public.players (id, name, role, active, created_at)
      select r.id, r.name, r.role, r.active, r.created_at from jsonb_populate_record(null::public.players, c.old_row) r;
    when 'fine_types' then
      insert into public.fine_types (id, name, default_amount, active, created_at)
      select r.id, r.name, r.default_amount, r.active, r.created_at from jsonb_populate_record(null::public.fine_types, c.old_row) r;
    else
      raise exception 'Esta linha não se pode repor.';
  end case;
exception
  when unique_violation then
    raise exception 'Esta linha já existe: já foi reposta, ou há outra igual.';
  when foreign_key_violation then
    raise exception 'Não é possível repor: o jogador ou o tipo de multa desta linha já não existe. Reponha-o primeiro.';
end $$;

revoke all on function public.log_change() from public, anon, authenticated;
revoke all on function public.list_changes(int) from public, anon;
revoke all on function public.restore_change(bigint) from public, anon;
grant execute on function public.list_changes(int) to authenticated;
grant execute on function public.restore_change(bigint) to authenticated;
