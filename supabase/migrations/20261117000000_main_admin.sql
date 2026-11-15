-- The first admin is the club's main admin and cannot be removed from the app, by anyone.
-- admins.is_owner marks them. It is set here for the earliest account that is an admin, so no
-- email address is written into the code; to change who it is, update that column by hand.

alter table public.admins add column is_owner boolean not null default false;

update public.admins set is_owner = true
where user_id = (
  select a.user_id from public.admins a join auth.users u on u.id = a.user_id
  where a.accepted_at is not null
  order by u.created_at limit 1
);

create or replace function public.remove_admin(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem fazer isto.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Não pode remover a sua própria conta de administrador.';
  end if;
  if exists (select 1 from public.admins where user_id = p_user_id and is_owner) then
    raise exception 'O administrador principal não pode ser removido.' using errcode = '42501';
  end if;
  delete from public.admins where user_id = p_user_id;
end $$;

-- A column is added, so the old function has to go first.
drop function public.list_admins();

create function public.list_admins() returns table (user_id uuid, email text, pending boolean, is_owner boolean)
language sql stable security definer set search_path = public as $$
  select a.user_id, u.email::text, a.accepted_at is null, a.is_owner
  from public.admins a join auth.users u on u.id = a.user_id
  where public.is_admin()
  order by a.is_owner desc, u.email;
$$;

revoke all on function public.list_admins() from public, anon;
grant execute on function public.list_admins() to authenticated;
