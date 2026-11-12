-- Admin management: list / remove admins from the app, and the helper the
-- invite-admin Edge Function uses (callable with the service role only).

create function public.list_admins() returns table (user_id uuid, email text)
language sql stable security definer set search_path = public as $$
  select a.user_id, u.email::text
  from public.admins a join auth.users u on u.id = a.user_id
  where public.is_admin()
  order by u.email;
$$;

create function public.remove_admin(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem fazer isto.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Não pode remover a sua própria conta de administrador.';
  end if;
  delete from public.admins where user_id = p_user_id;
end $$;

-- Makes an existing account an admin. Returns false if nobody has that email.
create function public.add_admin_by_email(p_email text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    return false;
  end if;
  insert into public.admins (user_id) values (uid) on conflict do nothing;
  return true;
end $$;

revoke all on function public.list_admins() from public, anon;
revoke all on function public.remove_admin(uuid) from public, anon;
grant execute on function public.list_admins() to authenticated;
grant execute on function public.remove_admin(uuid) to authenticated;

revoke all on function public.add_admin_by_email(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.add_admin_by_email(text) to service_role;
  end if;
end $$;
