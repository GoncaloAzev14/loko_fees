-- How a payment was made: MB WAY or cash.
--
-- Only these two values are allowed. The column is left empty (null) for the payments recorded before this
-- existed, so nothing already in the books is touched or guessed. The app asks for it on every new payment,
-- but the database does not insist, so an entry saved on a phone before this was installed is still accepted
-- when it is finally sent.

alter table public.payments
  add column method text check (method in ('mbway', 'dinheiro'));

-- Putting back a deleted payment from the history (Menu, Histórico) copies its columns one by one, so it has to
-- know this one too: otherwise a restored payment would lose how it was paid. Same function as before, plus method.
create or replace function public.restore_change(p_id bigint) returns void
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
      insert into public.payments (id, player_id, amount, paid_on, note, method, created_at)
      select r.id, r.player_id, r.amount, r.paid_on, r.note, r.method, r.created_at from jsonb_populate_record(null::public.payments, c.old_row) r;
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
