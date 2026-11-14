-- Tells apart admins who have chosen a password from those still holding an unfinished
-- invitation, so the Administradores page can show who is stuck and offer a resend.

-- The return type changes, so the old function has to go first.
drop function public.list_admins();

create function public.list_admins() returns table (user_id uuid, email text, pending boolean)
language sql stable security definer set search_path = public as $$
  select a.user_id, u.email::text, coalesce(u.encrypted_password, '') = ''
  from public.admins a join auth.users u on u.id = a.user_id
  where public.is_admin()
  order by u.email;
$$;

-- 'none' = no such account, 'pending' = account without a password yet, 'active' = can sign in.
-- Used by the invite-admin Edge Function to decide whether to send a fresh access code.
create function public.invite_state(p_email text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when coalesce(u.encrypted_password, '') = '' then 'pending' else 'active' end
     from auth.users u where lower(u.email) = lower(trim(p_email))),
    'none');
$$;

revoke all on function public.list_admins() from public, anon;
grant execute on function public.list_admins() to authenticated;

revoke all on function public.invite_state(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.invite_state(text) to service_role;
  end if;
end $$;
